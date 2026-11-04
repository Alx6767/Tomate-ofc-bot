/**
 * Pruebas del manejador con un WhatsApp de mentira.
 *
 * No se conecta a nada: se construye un `sock` falso que apunta lo que el bot
 * manda y se le inyectan mensajes como los que llegan de verdad. Así se
 * comprueba el camino completo: prefijo, permisos, cooldown, respuesta.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { crearHandler, extraerTexto, remitenteDe } from "../src/handler.js";
import { cargarPlugins } from "../src/loader.js";
import { Store } from "../src/store.js";
import { config } from "../src/config.js";

const registro = await cargarPlugins();

const DUENO = config.owners[0] || "5215500000000";
const YO = `${DUENO}@s.whatsapp.net`;
const OTRO = "5215599999999@s.whatsapp.net";
const GRUPO = "120363000000000000@g.us";

/** WhatsApp falso: guarda todo lo que se envía. */
function sockFalso() {
  const enviados = [];
  const sock = {
    user: { id: `${DUENO}:1@s.whatsapp.net`, name: "Tomate" },
    enviados,
    async sendMessage(jid, contenido, opciones) {
      enviados.push({ jid, contenido, opciones });
      return { key: { id: "x" } };
    },
    async groupMetadata() {
      return {
        subject: "Grupo de prueba",
        participants: [
          { id: YO, admin: "superadmin" },
          { id: OTRO, admin: null }
        ]
      };
    },
    async updateProfilePicture() {},
    async updateProfileName() {},
    async groupParticipantsUpdate() {},
    async groupSettingUpdate() {},
    async groupInviteCode() {
      return "https://chat.whatsapp.com/PRUEBA";
    },
    async groupRevokeInvite() {
      return "https://chat.whatsapp.com/NUEVO";
    }
  };
  return sock;
}

/** Arma el manejador con su propio almacén temporal. */
function montar() {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "tomate-handler-"));
  const store = new Store(path.join(carpeta, "datos.json"));
  const sock = sockFalso();
  const manejador = crearHandler({ sock, store, registro });
  return { sock, store, manejador };
}

/** Texto del último mensaje enviado. */
const ultimo = (sock) => {
  const ultimoEnvio = sock.enviados.at(-1);
  if (!ultimoEnvio) return "";
  const { contenido } = ultimoEnvio;
  return String(contenido.text || contenido.caption || "");
};

/** Inyecta un mensaje de texto y devuelve la respuesta. */
async function decir(manejador, sock, texto, { de = YO, chat = YO, mencionados = [], fromMe = false } = {}) {
  const antes = sock.enviados.length;
  await manejador.manejar({
    type: "notify",
    pushName: "Alguien",
    key: { remoteJid: chat, fromMe, id: `X${Date.now()}`, participant: chat.endsWith("@g.us") ? de : undefined },
    message: {
      extendedTextMessage: {
        text: texto,
        contextInfo: mencionados.length ? { mentionedJid: mencionados } : undefined
      }
    }
  });
  const nuevos = sock.enviados.slice(antes);
  // Algunos comandos mandan un «midiendo…» y luego lo editan: se juntan todos.
  const respuesta = nuevos
    .map((envio) => String(envio.contenido.text || envio.contenido.caption || ""))
    .join("\n");
  return { respuesta, nuevos };
}

test("extraerTexto lee los formatos habituales", () => {
  assert.equal(extraerTexto({ conversation: "hola" }), "hola");
  assert.equal(extraerTexto({ extendedTextMessage: { text: "menu" } }), "menu");
  assert.equal(extraerTexto({ imageMessage: { caption: ".toimg" } }), ".toimg");
  assert.equal(extraerTexto({ viewOnceMessage: { message: { conversation: ".ping" } } }), ".ping");
  assert.equal(extraerTexto({}), "");
  assert.equal(extraerTexto({ stickerMessage: {} }), "");
});

test("remitenteDe usa el participante en grupos", () => {
  assert.equal(remitenteDe({ remoteJid: GRUPO, participant: OTRO, fromMe: false }), OTRO);
  assert.equal(remitenteDe({ remoteJid: YO, fromMe: false }), YO);
});

test("responde al comando ping", async () => {
  const { sock, manejador } = montar();
  const { respuesta } = await decir(manejador, sock, ".ping");
  assert.match(respuesta, /pong|Pong|🏓/i);
});

test("el menú sale con el marchamo del bot", async () => {
  const { sock, manejador } = montar();
  const { respuesta } = await decir(manejador, sock, ".menu");
  assert.match(respuesta, /Tomate ofc/);
  assert.match(respuesta, /PLUGINS/);
  assert.match(respuesta, /EDITION/);
});

test("no responde a texto que no es comando", async () => {
  const { sock, manejador } = montar();
  const { nuevos } = await decir(manejador, sock, "hola, ¿cómo estás?");
  assert.equal(nuevos.filter((e) => e.contenido.text).length, 0);
});

test("acepta los tres prefijos", async () => {
  const { sock, manejador } = montar();
  for (const prefijo of [".", "!", "/"]) {
    const { respuesta } = await decir(manejador, sock, `${prefijo}ping`);
    assert.match(respuesta, /pong/i, `falló con el prefijo ${prefijo}`);
  }
});

test("calc no ejecuta código", async () => {
  const { sock, manejador } = montar();
  const { respuesta } = await decir(manejador, sock, ".calc 2+3*4");
  assert.match(respuesta, /14/);
  const { respuesta: mala } = await decir(manejador, sock, ".calc process.exit(1)");
  assert.match(mala, /no es una función|no permitido|mal escrito/i);
});

test("un comando de dueño se niega a otra persona", async () => {
  const { sock, manejador } = montar();
  const { respuesta } = await decir(manejador, sock, ".eval return 1+1", { chat: OTRO });
  assert.match(respuesta, /restringido|dueño|solo/i);
});

test("el dueño sí puede usar eval", async () => {
  const { sock, manejador } = montar();
  // El dueño escribe desde su propio teléfono: `fromMe` viene en true.
  const { respuesta } = await decir(manejador, sock, ".eval return 6*7", { fromMe: true });
  assert.match(respuesta, /42/);
});

test("un comando de grupo fuera de grupo avisa", async () => {
  const { sock, manejador } = montar();
  const { respuesta } = await decir(manejador, sock, ".kick 5215511111111");
  assert.match(respuesta, /grupo/i);
});

test("los comandos de adultos están apagados sin nsfw", { skip: config.nsfw }, async () => {
  const { sock, manejador } = montar();
  const { respuesta } = await decir(manejador, sock, ".r34 prueba", { chat: GRUPO });
  assert.match(respuesta, /apagado|desactivad|nsfw/i);
});

test("la economía responde y no rompe el saldo", async () => {
  const { sock, store, manejador } = montar();
  const { respuesta } = await decir(manejador, sock, ".bal");
  assert.match(respuesta, /0|tomate|saldo|balance/i);
  assert.ok(store.usuario(YO).coins >= 0);

  const { respuesta: dado } = await decir(manejador, sock, ".dado");
  assert.match(dado, /[1-6]/);
});

test("daily paga y no deja cobrar dos veces", async () => {
  const { sock, store, manejador } = montar();
  const { respuesta } = await decir(manejador, sock, ".daily");
  assert.doesNotMatch(respuesta, /^\s*$/);
  const saldo = store.usuario(YO).coins;
  assert.ok(saldo > 0, "daily debería dar monedas");

  const { respuesta: otraVez } = await decir(manejador, sock, ".daily");
  assert.match(otraVez, /espera|todavía|ya lo|hora|minuto|recogiste/i);
  assert.equal(store.usuario(YO).coins, saldo, "no debería pagar dos veces");
});

test("las fuentes de descarga se anuncian sin tocar la red", async () => {
  const { fuentesDisponibles } = await import("../src/fuentes.js");
  const hayBusqueda = await import("yt-search").then(() => true).catch(() => false);
  const fuentes = await fuentesDisponibles();
  assert.ok(Array.isArray(fuentes));
  if (hayBusqueda) {
    assert.ok(fuentes.includes("yt-search"), `debería incluir yt-search: ${fuentes.join(", ")}`);
  }
});

test("la IA avisa de que falta la clave", async () => {
  const { sock, manejador } = montar();
  const { respuesta } = await decir(manejador, sock, ".gemini hola");
  assert.match(respuesta, /clave|API|configur/i);
});

test("el comando desconocido no explota", async () => {
  const { sock, manejador } = montar();
  const { nuevos } = await decir(manejador, sock, ".estoNoExiste 123");
  assert.ok(Array.isArray(nuevos));
});

test("cada comando se puede ejecutar sin argumentos sin lanzar excepción", async () => {
  // Los que dependen de red o de archivos externos se saltan: aquí se busca
  // una excepción de programación, no una respuesta bonita.
  const saltar = new Set([
    "play", "play2", "ytinfo", "tiktok", "instagram", "facebook", "pinterest",
    "danbooru", "gelbooru", "apk", "clima", "pokemon", "pokedex", "pokebatalla",
    "tipo", "r34", "eval", "restart", "updategithub", "gclone", "code", "delbot",
    "albumurl", "savefile", "backup", "codemod", "saveper", "detectar",
    "acortar", "hd", "ia", "gemini", "chatgpt", "iasaurio", "simi",
    "kick", "ban", "promote", "demote", "close", "open", "link", "resetlink",
    "tag", "warn", "delwarn", "del", "antilink", "bienvenida", "mute",
    "setpfp", "setname", "album", "stickerract", "stickerreact", "toimg", "voz",
    "s", "sticker", "imagen", "edit", "igsearch", "tiktoksearch", "gitclone", "spack"
  ]);

  const { sock, store } = montar();
  const cuerpo = store;
  const errores = [];
  for (const comando of registro.lista) {
    if (saltar.has(comando.name)) continue;
    const capturado = [];
    const contexto = {
      sock,
      msg: {
        key: { remoteJid: YO }, chat: YO, sender: YO, numero: DUENO, pushName: "Prueba",
        isGroup: false, isFromMe: true, text: `.${comando.name}`, argumentoTexto: "",
        mentionedJid: [], quoted: null, mediaType: "", raw: {}
      },
      chat: YO,
      sender: YO,
      args: [],
      text: "",
      command: comando.name,
      usedPrefix: ".",
      config,
      store: cuerpo,
      db: cuerpo,
      isOwner: true,
      isMod: true,
      isAdmin: true,
      isBotAdmin: true,
      participants: [],
      groupMetadata: null,
      menu: () => "",
      comandos: registro.comandos,
      lista: registro.lista,
      async reply(texto) { capturado.push(String(texto)); },
      async send() {},
      async react() {},
      async descargar() { throw new Error("sin multimedia en la prueba"); }
    };
    try {
      await comando.run(contexto);
    } catch (error) {
      errores.push(`${comando.name}: ${error.message}`);
    }
  }
  assert.deepEqual(errores, []);
});
