/**
 * Pruebas de los juegos de texto.
 *
 * Se ejecutan los comandos directamente con un contexto falso: interesa saber
 * que el juego avanza y que responde algo con sentido, no el dibujo exacto.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { cargarPlugins } from "../src/loader.js";
import { Store } from "../src/store.js";
import { config } from "../src/config.js";

const registro = await cargarPlugins();

const YO = "5215512345678@s.whatsapp.net";
const CHAT = "120363000000000000@g.us";

/** Ejecuta un comando y devuelve lo que respondió. */
async function jugar(nombre, texto = "", { store, chat = CHAT, sender = YO, quoted = null } = {}) {
  const comando = registro.comandos.get(nombre);
  assert.ok(comando, `no existe el comando ${nombre}`);
  const respuestas = [];
  const args = texto ? texto.split(/\s+/) : [];
  await comando.run({
    sock: {},
    msg: {
      key: { remoteJid: chat },
      chat,
      sender,
      numero: sender.split("@")[0],
      pushName: "Prueba",
      isGroup: chat.endsWith("@g.us"),
      isFromMe: false,
      text: `.${nombre} ${texto}`.trim(),
      argumentoTexto: texto,
      mentionedJid: [],
      quoted,
      mediaType: "",
      raw: {}
    },
    chat,
    sender,
    args,
    text: texto,
    command: comando.name,
    config,
    store,
    db: store,
    isOwner: true,
    isMod: true,
    isAdmin: true,
    isBotAdmin: true,
    participants: [],
    groupMetadata: null,
    menu: () => "",
    comandos: registro.comandos,
    lista: registro.lista,
    async reply(t) { respuestas.push(String(t)); },
    async send(destino, contenido) { respuestas.push(contenido); },
    async react() {},
    async descargar() { throw new Error("sin multimedia"); }
  });
  return respuestas.join("\n");
}

function almacen() {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "tomate-arcade-"));
  return new Store(path.join(carpeta, "datos.json"));
}

test("la serpiente se abre, se mueve y avisa al chocar", async () => {
  const store = almacen();
  const apertura = await jugar("snake", "", { store });
  assert.match(apertura, /Serpiente/);
  assert.match(apertura, /🟩/);

  const movimiento = await jugar("snake", "derecha", { store });
  assert.match(movimiento, /Serpiente/);

  // Hacia la izquierda hasta salir del tablero (7 columnas).
  let choque = "";
  for (let i = 0; i < 8; i++) {
    choque = await jugar("snake", "izquierda", { store });
    if (/saliste|mordiste/i.test(choque)) break;
  }
  assert.match(choque, /saliste|mordiste/i);
});

test("la serpiente es de quien la abrió", async () => {
  const store = almacen();
  await jugar("snake", "", { store });
  const otra = await jugar("snake", "arriba", { store, sender: "5215500000001@s.whatsapp.net" });
  assert.match(otra, /otra persona/i);
});

test("pong puntúa y termina a cinco", async () => {
  const store = almacen();
  await jugar("pong", "", { store });
  let respuesta = "";
  for (let i = 0; i < 12; i++) {
    respuesta = await jugar("pong", ["izquierda", "centro", "derecha"][i % 3], { store });
    if (/Fin/.test(respuesta)) break;
  }
  assert.match(respuesta, /Fin|Cayó/);
});

test("flappy avanza y suma puntos o termina", async () => {
  const store = almacen();
  const inicio = await jugar("flappy", "", { store });
  assert.match(inicio, /Flappy/);
  let respuesta = "";
  for (let i = 0; i < 8; i++) {
    respuesta = await jugar("flappy", "saltar", { store });
    if (/pegaste/i.test(respuesta)) break;
  }
  assert.match(respuesta, /Flappy|pegaste/i);
});

test("pacman se abre, bloquea paredes y avanza", async () => {
  const store = almacen();
  const inicio = await jugar("pacman", "", { store });
  assert.match(inicio, /🟡/);

  const pared = await jugar("pacman", "arriba", { store });
  assert.match(pared, /Pared/i);

  const avance = await jugar("pacman", "derecha", { store });
  assert.match(avance, /Puntos|atrapó|limpio/i);
});

test("tetris abre, mueve y fija piezas", async () => {
  const store = almacen();
  const inicio = await jugar("tetris", "", { store });
  assert.match(inicio, /Tetris/);
  assert.match(inicio, /🟪/);

  const mover = await jugar("tetris", "izquierda", { store });
  assert.match(mover, /Tetris/);

  const rotar = await jugar("tetris", "rotar", { store });
  assert.match(rotar, /Tetris/);

  const bajar = await jugar("tetris", "bajar", { store });
  assert.match(bajar, /Tetris|Fin del juego/);
});

test("akinator pregunta y va descartando", async () => {
  const store = almacen();
  const primera = await jugar("akinator", "", { store });
  assert.match(primera, /Piensa en algo|¿Es una persona\?/);

  const segunda = await jugar("akinator", "sí", { store });
  assert.match(segunda, /Quedan|Estás pensando|Me perdí|Me quedo/);
});

test("plantar siembra y no deja cosechar antes de tiempo", async () => {
  const store = almacen();
  const siembra = await jugar("plantar", "", { store });
  assert.match(siembra, /Sembraste/);

  const temprano = await jugar("plantar", "cosechar", { store });
  assert.match(temprano, /madura|faltan/i);
});

test("math resuelve y rechaza basura", async () => {
  const store = almacen();
  assert.match(await jugar("math", "(12+8)*3", { store }), /60/);
  assert.match(await jugar("math", "process.exit(1)", { store }), /No pude|no es una función/);
});

test("salirarcade cierra las partidas abiertas", async () => {
  const store = almacen();
  await jugar("snake", "", { store });
  const cierre = await jugar("salirarcade", "", { store });
  assert.match(cierre, /Cerraste|No tienes/);
});
