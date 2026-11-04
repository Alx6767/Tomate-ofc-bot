/**
 * Tomate ofc bot — arranque.
 *
 * Responsabilidades de este archivo, y de nadie más:
 *   · abrir la sesión de WhatsApp (QR o código de vinculación),
 *   · reconectar cuando se cae, con espera creciente,
 *   · entregar los mensajes al manejador,
 *   · no morir por un error suelto.
 *
 * Todo lo demás está en `src/` y en `plugins/`.
 */

import fs from "node:fs";
import path from "node:path";
import { config } from "./src/config.js";
import log from "./src/logger.js";
import { Store } from "./src/store.js";
import { cargarPlugins } from "./src/loader.js";
import { crearHandler } from "./src/handler.js";
import { normalizarTelefono } from "./src/utils.js";

const VERSION_MINIMA = 20;

if (Number(process.versions.node.split(".")[0]) < VERSION_MINIMA) {
  log.error(`Node ${process.versions.node} es demasiado viejo; hace falta Node ${VERSION_MINIMA} o más.`);
  process.exit(1);
}

// El bot no debe caerse por una promesa olvidada: se registra y se sigue.
process.on("unhandledRejection", (motivo) => log.error(`promesa sin manejar: ${motivo?.message || motivo}`));
process.on("uncaughtException", (error) => log.error(`excepción no capturada: ${error?.stack || error}`));

/** Espera creciente con algo de azar, para no reconectar todos a la vez. */
const esperas = [2000, 5000, 10000, 20000, 30000];
const esperaPara = (intento) => esperas[Math.min(intento, esperas.length - 1)] + Math.floor(Math.random() * 800);

/** Borra la sesión: solo se usa cuando WhatsApp dice que el dispositivo se cerró. */
function limpiarSesion() {
  try {
    fs.rmSync(config.rutas.sesion, { recursive: true, force: true });
    log.aviso("sesión borrada; hará falta vincular de nuevo");
  } catch (error) {
    log.error(`no se pudo borrar la sesión: ${error.message}`);
  }
}

async function arrancar() {
  await import("@whiskeysockets/baileys").catch(() => {
    log.error("falta instalar las dependencias. Ejecuta: npm install");
    process.exit(1);
  });

  const baileys = await import("@whiskeysockets/baileys");
  const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    Browsers
  } = baileys;

  const pino = (await import("pino")).default;
  const silencio = pino({ level: "silent" });

  fs.mkdirSync(config.rutas.sesion, { recursive: true });
  fs.mkdirSync(config.rutas.datos, { recursive: true });

  const { comandos, lista, fallos } = await cargarPlugins();

  log.titulo(`
   🍅  ${config.nombre}
   ─────────────────────────────────────────`);
  log.ok(`${lista.length} comandos cargados en ${new Set(lista.map((c) => c.category)).size} categorías`);
  for (const fallo of fallos) log.aviso(`plugin con problemas → ${fallo}`);
  if (!config.owners.length) {
    log.aviso("no hay OWNER configurado: nadie podrá usar los comandos de dueño");
  }

  const store = new Store(path.join(config.rutas.datos, "tomate.json"));
  let intento = 0;
  // `registro` se reemplaza en caliente desde el comando `reload`.
  const registro = { comandos, lista };

  async function conectar() {
    const { state, saveCreds } = await useMultiFileAuthState(config.rutas.sesion);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger: silencio,
      printQRInTerminal: false,
      browser: Browsers.ubuntu("Chrome"),
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, silencio)
      },
      markOnlineOnConnect: true,
      syncFullHistory: false,
      generateHighQualityLinkPreview: true
    });

    const manejador = crearHandler({ sock, store, registro });
    globalThis.__tomateManejador = manejador;

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("messages.upsert", (evento) => {
      for (const mensaje of evento.messages || []) manejador.manejar(mensaje);
    });
    sock.ev.on("group-participants.update", (evento) => manejador.alEntrar(evento));

    // ── Vinculación ────────────────────────────────────────────────
    if (config.metodo === "code" && !sock.authState.creds.registered) {
      const telefono = normalizarTelefono(config.numeroVinculacion);
      if (!telefono) {
        log.aviso("PAIRING=code pero no hay PAIRING_NUMBER válido; se usará QR");
      } else {
        // El código necesita el socket abierto: se espera a que lo esté.
        const listo = await new Promise((resolver) => {
          const limite = setTimeout(() => resolver(false), 20_000);
          sock.ev.on("connection.update", (estado) => {
            if (estado.qr || estado.connection === "connecting") {
              clearTimeout(limite);
              resolver(true);
            }
          });
          if (sock.ws?.isOpen) {
            clearTimeout(limite);
            resolver(true);
          }
        });

        if (listo) {
          try {
            const codigo = config.codigoVinculacion || undefined;
            const emitido = await sock.requestPairingCode(telefono, codigo);
            log.tomate(`Código de vinculación: ${emitido}`);
            log.info("WhatsApp → Dispositivos vinculados → Vincular con número de teléfono.");
          } catch (error) {
            log.error(`no se pudo pedir el código: ${error.message}`);
            log.info("Se sigue con QR por si acaso.");
          }
        }
      }
    }

    sock.ev.on("connection.update", async (estado) => {
      const { connection, lastDisconnect, qr } = estado;

      if (qr && config.metodo === "qr") {
        const qrcode = (await import("qrcode-terminal")).default;
        log.info("Escanea este QR desde WhatsApp → Dispositivos vinculados:");
        qrcode.generate(qr, { small: true });
      }

      if (connection === "open") {
        intento = 0;
        log.ok(`conectado como ${sock.user?.id || "?"}`);
        log.tomate(`${registro.lista.length} comandos disponibles · prefijos ${config.prefijos.join(" ")}`);
      }

      if (connection === "close") {
        const codigo = lastDisconnect?.error?.output?.statusCode;
        const motivo = lastDisconnect?.error?.message || "sin detalle";

        if (codigo === DisconnectReason.loggedOut) {
          log.error("WhatsApp cerró la sesión de este dispositivo.");
          limpiarSesion();
          log.info("Arrancando de nuevo para vincular…");
          setTimeout(conectar, 2000);
          return;
        }

        intento += 1;
        const espera = esperaPara(intento);
        log.aviso(`conexión cerrada (${codigo ?? "?"} ${motivo}); reintento ${intento} en ${Math.round(espera / 1000)} s`);
        setTimeout(conectar, espera);
      }
    });

    return sock;
  }

  // Recarga de plugins sin reiniciar el proceso: se vuelve a leer la carpeta
  // y se sustituye el contenido de `registro`, que es el objeto que el
  // manejador consulta en cada mensaje.
  globalThis.__tomateRecargar = async () => {
    const nuevo = await cargarPlugins();
    registro.comandos = nuevo.comandos;
    registro.lista = nuevo.lista;
    return nuevo;
  };

  await conectar();
}

arrancar().catch((error) => {
  log.error(`no se pudo arrancar: ${error?.stack || error}`);
  process.exit(1);
});
