/**
 * Tomate ofc bot — el manejador de mensajes.
 *
 * Aquí pasa todo lo que ocurre entre «llega un mensaje» y «responde el
 * comando». El orden importa y es este:
 *
 *   1. Se descarta lo que no es un mensaje de usuario (estados, protocolo,
 *      mensajes propios del bot, reacciones).
 *   2. Se registra al usuario y se le da experiencia (como mucho una vez por
 *      minuto, para que no se suba de nivel escribiendo rápido).
 *   3. Si es un grupo, se aplican las reglas del grupo (anti-enlace).
 *   4. Si el mensaje empieza por prefijo, se busca el comando y se comprueban
 *      permisos y enfriamiento.
 *   5. El comando corre dentro de un try: un error del comando responde al
 *      usuario con un mensaje corto y se registra completo en consola. Nunca
 *      deja el proceso caído.
 */

import { config, esDueno, esModerador } from "./config.js";
import log from "./logger.js";
import { construirMenu, fichaComando } from "./menu.js";
import { descargarMedia } from "./media.js";
import * as utils from "./utils.js";

/** Cuánto dura la caché de metadatos de un grupo. */
const TTL_GRUPO = 60_000;

/** Enfriamiento por defecto cuando un comando no declara el suyo. */
const ENFRIAMIENTO_BASE = 2_000;

/** Texto visible de un mensaje, sea del tipo que sea. */
/**
 * Saca el `id` de una respuesta de botón o de lista.
 *
 * WhatsApp manda el texto y el id por caminos distintos según el tipo de
 * interactivo; aquí se juntan los cuatro que existen para que un botón pueda
 * disparar un comando como si se hubiera escrito.
 */
function idDeBoton(interior) {
  if (interior.buttonsResponseMessage) return interior.buttonsResponseMessage.selectedButtonId || "";
  if (interior.templateButtonReplyMessage) return interior.templateButtonReplyMessage.selectedId || "";
  if (interior.listResponseMessage) return interior.listResponseMessage.singleSelectReply?.selectedRowId || "";
  if (interior.interactiveResponseMessage) {
    const crudo = interior.interactiveResponseMessage.nativeFlowResponseMessage?.paramsJson;
    if (!crudo) return "";
    try {
      const datos = JSON.parse(crudo);
      return datos.id || datos.button_id || datos.selectedId || "";
    } catch {
      return "";
    }
  }
  return "";
}

export function extraerTexto(mensaje) {
  if (!mensaje) return "";
  const m = mensaje.ephemeralMessage?.message
    || mensaje.viewOnceMessage?.message
    || mensaje.viewOnceMessageV2?.message
    || mensaje.documentWithCaptionMessage?.message
    || mensaje;
  const texto = m.conversation
    || m.extendedTextMessage?.text
    || m.imageMessage?.caption
    || m.videoMessage?.caption
    || m.documentMessage?.caption
    || "";
  if (texto) return texto.toString();
  // Si no hay texto, puede ser la respuesta a un botón o a una lista.
  return idDeBoton(m).toString();
}

/** Tipo de medio que trae el mensaje, si trae alguno. */
export function tipoDeMedio(mensaje) {
  if (!mensaje) return "";
  const m = mensaje.ephemeralMessage?.message || mensaje.viewOnceMessage?.message || mensaje;
  const tipos = ["imageMessage", "videoMessage", "audioMessage", "documentMessage", "stickerMessage"];
  return tipos.find((tipo) => m[tipo]) || "";
}

/** El JID del que escribe, sin el sufijo de dispositivo. */
export function remitenteDe(clave, sock) {
  if (!clave) return "";
  const jid = clave.participant || clave.remoteJid || "";
  if (clave.fromMe) return sock?.user?.id?.split(":")[0] + "@s.whatsapp.net";
  return jid;
}

/**
 * Crea el manejador. Devuelve la función que se conecta a `messages.upsert`.
 */
export function crearHandler({ sock, store, registro }) {
  /** Los comandos viven en `registro` para poder recargarlos sin reiniciar. */
  const comandos = () => registro.comandos;
  const lista = () => registro.lista;
  const enfriamientos = new Map();
  const gruposCache = new Map();
  const ultimaXp = new Map();
  const ritmo = new Map();

  /** Metadatos del grupo, con caché corta para no pedirlos en cada mensaje. */
  async function metadatos(jid) {
    const guardado = gruposCache.get(jid);
    if (guardado && Date.now() - guardado.cuando < TTL_GRUPO) return guardado.datos;
    try {
      const datos = await sock.groupMetadata(jid);
      gruposCache.set(jid, { cuando: Date.now(), datos });
      return datos;
    } catch {
      return null;
    }
  }

  /** Menú listo para enviar. */
  const menuPara = () => construirMenu({
    lista: lista(),
    usuarios: Object.keys(store.datos.usuarios).length,
    prefijo: config.prefijos[0]
  });

  async function manejar(entrada) {
    try {
      const clave = entrada.key;
      if (!clave?.remoteJid) return;
      if (entrada.type && entrada.type !== "notify") return;
      if (clave.remoteJid === "status@broadcast") return;
      if (clave.remoteJid === "1234@s.whatsapp.net") return;

      const contenido = entrada.message || {};
      const interior = contenido.ephemeralMessage?.message
        || contenido.viewOnceMessage?.message
        || contenido.viewOnceMessageV2?.message
        || contenido;
      if (interior.protocolMessage || interior.senderKeyDistributionMessage || interior.reactionMessage) return;

      const texto = extraerTexto(contenido);
      if (!texto) return;

      const chat = clave.remoteJid;
      const esGrupo = chat.endsWith("@g.us");
      const remitente = remitenteDe(clave, sock);
      const numero = utils.nombreCorto(remitente);

      // ── 1. Registro y experiencia ───────────────────────────────────
      const usuario = store.usuario(remitente);
      const ahora = Date.now();
      if (!ultimaXp.has(remitente) || ahora - ultimaXp.get(remitente) > 60_000) {
        ultimaXp.set(remitente, ahora);
        const subida = store.darXp(remitente, utils.azar(3, 8));
        if (subida.subio && esGrupo) {
          await sock.sendMessage(chat, {
            text: `🍅 *${entrada.pushName || numero}* subió a nivel *${subida.nivel}*.`
          }).catch(() => {});
        }
      }

      // ── 2. Permisos básicos ─────────────────────────────────────────
      const yo = (sock.user?.id || "").split(":")[0];
      const dueno = esDueno(numero) || clave.fromMe || (yo && numero === yo);
      const moderador = dueno || esModerador(numero);

      if (config.modoPrivado && !moderador && !comandos().has(texto.slice(1).split(/\s+/)[0]?.toLowerCase())) {
        return;
      }

      // ── 3. Reglas de grupo ──────────────────────────────────────────
      let admin = false;
      let botAdmin = false;
      let participantes = [];
      let metadatosGrupo = null;

      if (esGrupo) {
        metadatosGrupo = await metadatos(chat);
        participantes = metadatosGrupo?.participants || [];
        const buscar = (jid) => participantes.find((p) => p.id === jid || p.jid === jid || p.lid === jid);
        const mio = buscar(remitente) || participantes.find((p) => utils.nombreCorto(p.id) === numero);
        admin = Boolean(mio?.admin);
        const bot = participantes.find((p) => utils.nombreCorto(p.id) === yo);
        botAdmin = Boolean(bot?.admin);

        const ajustes = store.chat(chat);
        if (config.antiEnlace && ajustes.antilink !== false && !admin && !dueno) {
          const esEnlace = /chat\.whatsapp\.com\/[0-9A-Za-z]{20,}/i.test(texto);
          if (esEnlace) {
            if (botAdmin) {
              await sock.sendMessage(chat, { delete: clave }).catch(() => {});
              await sock.sendMessage(chat, {
                text: `🍅 *${entrada.pushName || numero}*, los enlaces de grupo no van aquí.`
              }).catch(() => {});
              return;
            }
            await sock.sendMessage(chat, {
              text: "🍅 Pasaría el anti-enlace, pero necesito ser administrador para borrar."
            }).catch(() => {});
          }
        }

        // Filtro de invitaciones (antinu): enlaces de canal y de otros grupos.
        if (ajustes.antinu && !admin && !dueno) {
          const invitacion = /whatsapp\.com\/channel\/|chat\.whatsapp\.com\/[0-9A-Za-z]{15,}/i.test(texto);
          if (invitacion && botAdmin) {
            await sock.sendMessage(chat, { delete: clave }).catch(() => {});
            await sock.sendMessage(chat, {
              text: `🍅 *${entrada.pushName || numero}*, aquí no se comparten invitaciones.`
            }).catch(() => {});
            return;
          }
        }
      }

      // ── 4. ¿Es un comando? ──────────────────────────────────────────
      const prefijoUsado = config.prefijos.find((p) => texto.startsWith(p));
      if (!prefijoUsado) return;

      const sinPrefijo = texto.slice(prefijoUsado.length).trim();
      if (!sinPrefijo) return;
      const [nombreCrudo, ...restoPartes] = sinPrefijo.split(/\s+/);
      const nombre = nombreCrudo.toLowerCase();
      const argumentos = restoPartes;
      const argumentoTexto = sinPrefijo.slice(nombreCrudo.length).trim();

      // Atajos que no son plugins.
      if (nombre === "menu" || nombre === "menú") {
        await sock.sendMessage(chat, { text: menuPara() }, { quoted: entrada });
        return;
      }

      const comando = comandos().get(nombre);
      if (!comando) return;

      // ── 5. Restricciones del comando ────────────────────────────────
      if (comando.owner && !dueno) return responderSinPermiso(chat, entrada, "solo el dueño");
      if (comando.mod && !moderador) return responderSinPermiso(chat, entrada, "solo moderadores");
      if (comando.group && !esGrupo) {
        await sock.sendMessage(chat, { text: "🍅 Este comando solo funciona en grupos." }, { quoted: entrada });
        return;
      }
      if (comando.private && esGrupo) {
        await sock.sendMessage(chat, { text: "🍅 Este comando solo funciona en privado." }, { quoted: entrada });
        return;
      }
      if (comando.admin && esGrupo && !admin && !dueno) {
        await sock.sendMessage(chat, { text: "🍅 Necesitas ser administrador del grupo." }, { quoted: entrada });
        return;
      }
      if (comando.botAdmin && esGrupo && !botAdmin) {
        await sock.sendMessage(chat, { text: "🍅 Necesito ser administrador para hacer eso." }, { quoted: entrada });
        return;
      }
      if (comando.nsfw && !config.nsfw) {
        await sock.sendMessage(chat, {
          text: "🍅 Este comando está apagado. Se enciende con `NSFW=true` en el archivo `.env`."
        }, { quoted: entrada });
        return;
      }

      // ── 6. Ritmo y enfriamiento ─────────────────────────────────────
      if (config.ritmo > 0 && !dueno) {
        const marca = ritmo.get(chat) || { desde: ahora, cuantos: 0 };
        if (ahora - marca.desde > 60_000) {
          marca.desde = ahora;
          marca.cuantos = 0;
        }
        marca.cuantos += 1;
        ritmo.set(chat, marca);
        if (marca.cuantos > config.ritmo) return;
      }

      const llave = `${remitente}:${comando.name}`;
      const espera = Math.max(comando.cooldown * 1000, ENFRIAMIENTO_BASE);
      const ultimo = enfriamientos.get(llave) || 0;
      if (!dueno && ahora - ultimo < espera) return;
      enfriamientos.set(llave, ahora);

      // ── 7. Contexto del comando ─────────────────────────────────────
      const mensaje = {
        key: clave,
        chat,
        sender: remitente,
        numero,
        pushName: entrada.pushName || "",
        isGroup: esGrupo,
        isFromMe: Boolean(clave.fromMe),
        text: texto,
        argumentoTexto,
        mentionedJid: interior.extendedTextMessage?.contextInfo?.mentionedJid
          || interior.imageMessage?.contextInfo?.mentionedJid
          || [],
        quoted: interior.extendedTextMessage?.contextInfo || null,
        mediaType: tipoDeMedio(contenido),
        raw: entrada
      };

      const contexto = {
        sock,
        msg: mensaje,
        chat,
        sender: remitente,
        args: argumentos,
        text: argumentoTexto,
        command: comando.name,
        usedPrefix: prefijoUsado,
        config,
        store,
        db: store,
        utils,
        isOwner: dueno,
        isMod: moderador,
        isAdmin: admin,
        isBotAdmin: botAdmin,
        participants: participantes,
        groupMetadata: metadatosGrupo,
        menu: menuPara,
        comandos: comandos(),
        lista: lista(),
        async reply(textoRespuesta, opciones = {}) {
          return sock.sendMessage(chat, { text: String(textoRespuesta), ...opciones }, { quoted: entrada });
        },
        async send(destino, contenido, opciones = {}) {
          return sock.sendMessage(destino, contenido, opciones);
        },
        async react(emoji) {
          return sock.sendMessage(chat, { react: { text: emoji, key: clave } }).catch(() => {});
        },
        async descargar(cual = "") {
          const citado = mensaje.quoted?.quotedMessage
            ? { message: mensaje.quoted.quotedMessage, key: { ...clave, id: mensaje.quoted.stanzaId } }
            : entrada;
          return descargarMedia(sock, citado, cual);
        }
      };

      // ── 8. Ejecución ────────────────────────────────────────────────
      const inicio = Date.now();
      try {
        await comando.run(contexto);
      } catch (error) {
        log.error(`comando «${comando.name}» de ${numero}: ${error?.message || error}`);
        await sock.sendMessage(chat, {
          text: `🍅 El comando *${comando.name}* falló: ${utils.recortar(error?.message || "error desconocido", 160)}`
        }, { quoted: entrada }).catch(() => {});
      }
      log.info(`${comando.name} · ${numero} · ${Date.now() - inicio} ms`);
    } catch (error) {
      log.error(`manejador: ${error?.message || error}`);
    }
  }

  async function responderSinPermiso(chat, entrada, motivo) {
    await sock.sendMessage(chat, { text: `🍅 Comando restringido: ${motivo}.` }, { quoted: entrada }).catch(() => {});
  }

  /** Mensaje de bienvenida cuando entra alguien. */
  async function alEntrar(evento) {
    try {
      const chat = evento.id;
      if (!chat?.endsWith("@g.us")) return;
      const ajustes = store.chat(chat);
      const gente = evento.participants || [];
      if (!gente.length) return;

      // Auto-administrador: asciende a quien entra y quita el puesto a quien sale.
      if (ajustes.autoadmin) {
        const accion = evento.action === "add" ? "promote" : evento.action === "remove" ? "demote" : null;
        if (accion) await sock.groupParticipantsUpdate(chat, gente, accion).catch(() => {});
      }

      if (!ajustes.bienvenida || evento.action !== "add") return;
      for (const quien of gente) {
        const nombre = utils.nombreCorto(quien);
        await sock.sendMessage(chat, {
          text: `🍅 Bienvenido/a *${nombre}*.\nEscribe *${config.prefijos[0]}menu* para ver los comandos.`
        }).catch(() => {});
      }
    } catch (error) {
      log.error(`bienvenida: ${error?.message || error}`);
    }
  }

  /** Atajo para que `help` funcione igual desde cualquier sitio. */
  function ayuda(nombre) {
    if (!nombre) return null;
    const comando = comandos().get(String(nombre).toLowerCase());
    return fichaComando(comando, config.prefijos[0]);
  }

  return { manejar, alEntrar, ayuda, menuPara };
}

export default crearHandler;
