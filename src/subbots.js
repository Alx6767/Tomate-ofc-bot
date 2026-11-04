/**
 * Tomate ofc bot — sub-bots.
 *
 * Un sub-bot es otra cuenta de WhatsApp conectada desde el mismo proceso, con
 * su propia sesión y su propio manejador de mensajes. Sirve para que el bot
 * atienda desde un número distinto sin abrir otra terminal.
 *
 * Cada sub-bot guarda su sesión en `sesion/sub-<número>/`, así que se puede
 * reiniciar sin volver a vincular. Los sub-bots viven mientras viva el
 * proceso: si el bot se reinicia, hay que volver a arrancarlos.
 */

import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import log from "./logger.js";
import { crearHandler } from "./handler.js";

/** numero → { sock, jid, creado } */
const activos = new Map();

/** Ruta de la sesión de un sub-bot. */
export const carpetaDe = (numero) => path.join(config.rutas.sesion, `sub-${numero}`);

/** Lista de sub-bots conectados en este proceso. */
export function listar() {
  return [...activos.entries()].map(([numero, datos]) => ({
    numero,
    jid: datos.jid || "",
    conectado: Boolean(datos.sock?.ws?.isOpen),
    creado: datos.creado
  }));
}

/** Cierra un sub-bot y, opcionalmente, borra su sesión. */
export function cerrar(numero, { borrarSesion = false } = {}) {
  const datos = activos.get(numero);
  if (!datos) return false;
  try {
    datos.sock?.end?.(new Error("cerrado desde el bot principal"));
  } catch {
    // Da igual: se quita del registro igualmente.
  }
  activos.delete(numero);
  if (borrarSesion) {
    try {
      fs.rmSync(carpetaDe(numero), { recursive: true, force: true });
    } catch (error) {
      log.aviso(`no se pudo borrar la sesión del sub-bot ${numero}: ${error.message}`);
    }
  }
  return true;
}

/**
 * Arranca un sub-bot y devuelve el código de vinculación.
 *
 * @param {object} opciones
 * @param {string} opciones.numero número en formato internacional sin signos
 * @param {object} opciones.registro registro de comandos compartido
 * @param {object} opciones.store almacén compartido
 * @param {string} [opciones.codigo] código fijo de 8 caracteres
 * @returns {Promise<{codigo: string, numero: string}>}
 */
export async function crear({ numero, registro, store, codigo }) {
  const limpio = String(numero || "").replace(/\D/g, "");
  if (limpio.length < 8) throw new Error("el número no parece completo");
  if (activos.has(limpio)) throw new Error("ese número ya tiene un sub-bot en marcha");

  const baileys = await import("@whiskeysockets/baileys");
  const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers
  } = baileys;
  const pino = (await import("pino")).default;
  const silencio = pino({ level: "silent" });

  const carpeta = carpetaDe(limpio);
  fs.mkdirSync(carpeta, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(carpeta);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: silencio,
    printQRInTerminal: false,
    browser: Browsers.ubuntu("Chrome"),
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, silencio) },
    markOnlineOnConnect: true,
    syncFullHistory: false
  });

  const manejador = crearHandler({ sock, store, registro });
  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("messages.upsert", (evento) => {
    for (const mensaje of evento.messages || []) manejador.manejar(mensaje);
  });
  sock.ev.on("group-participants.update", (evento) => manejador.alEntrar(evento));

  activos.set(limpio, { sock, jid: "", creado: Date.now() });

  sock.ev.on("connection.update", (estado) => {
    if (estado.connection === "open") {
      const datos = activos.get(limpio);
      if (datos) datos.jid = sock.user?.id || "";
      log.ok(`sub-bot ${limpio} conectado`);
    }
    if (estado.connection === "close") {
      const entrada = activos.get(limpio);
      if (entrada) {
        entrada.jid = "";
        log.aviso(`sub-bot ${limpio} desconectado; se puede reconectar con .code`);
      }
    }
  });

  // El código necesita el socket abierto: se espera con sondeo corto.
  const limite = Date.now() + 15000;
  while (!sock.ws?.isOpen && Date.now() < limite) {
    await new Promise((listo) => setTimeout(listo, 200));
  }

  try {
    const emitido = await sock.requestPairingCode(limpio, codigo || undefined);
    return { codigo: emitido, numero: limpio };
  } catch (error) {
    cerrar(limpio);
    throw new Error(`no se pudo pedir el código: ${error.message}`);
  }
}
