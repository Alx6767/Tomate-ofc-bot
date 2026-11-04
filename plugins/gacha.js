/**
 * Tomate ofc bot — gacha.
 *
 * El catálogo está en `data/personajes.json`: se puede editar a mano y el bot
 * lo relee al arrancar. Los personajes son inventados a propósito; si quieres
 * usar otro catálogo, cambia el archivo y conserva los campos `id`, `nombre`,
 * `serie`, `rareza` (1 a 5) y `precio`.
 */

import fs from "node:fs";
import path from "node:path";
import { RAIZ } from "../src/config.js";
import { azar, elegir, monedas, nombreCorto, numero } from "../src/utils.js";

/** Catálogo en memoria. */
const catalogo = (() => {
  try {
    const crudo = fs.readFileSync(path.join(RAIZ, "data", "personajes.json"), "utf8");
    const datos = JSON.parse(crudo);
    return Array.isArray(datos.personajes) ? datos.personajes : [];
  } catch {
    return [];
  }
})();

const porId = new Map(catalogo.map((p) => [p.id, p]));

/** Último personaje que salió en cada chat, para poder reclamarlo. */
const ultimoSorteo = new Map();

/** Estrellas según rareza. */
const estrellas = (rareza) => "★".repeat(rareza) + "☆".repeat(5 - rareza);

/** Elige un personaje con más probabilidad para los comunes. */
function sortear() {
  const peso = (p) => 6 - p.rareza;
  const total = catalogo.reduce((suma, p) => suma + peso(p), 0);
  let punto = azar(1, total);
  for (const personaje of catalogo) {
    punto -= peso(personaje);
    if (punto <= 0) return personaje;
  }
  return elegir(catalogo);
}

/** Ficha corta de un personaje. */
const ficha = (p) =>
  `*${p.nombre}* ${estrellas(p.rareza)}\n· Serie: ${p.serie}\n· Precio: ${monedas(p.precio)}`;

export default [
  {
    name: "rollwaifu",
    aliases: ["roll", "gacha"],
    category: "gacha",
    desc: "Saca un personaje al azar y puedes reclamarlo.",
    run: async ({ reply, chat, msg, store }) => {
      if (!catalogo.length) return reply("🍅 El catálogo está vacío: revisa `data/personajes.json`.");
      const personaje = sortear();
      const usuario = store.usuario(msg.sender);
      const yaLoTiene = usuario.gacha.reclamados.includes(personaje.id);
      ultimoSorteo.set(chat, { id: personaje.id, de: msg.sender, cuando: Date.now() });
      return reply(
        `🍅 *Salió del huerto…*\n\n${ficha(personaje)}\n\n` +
          (yaLoTiene ? "_Ya lo tienes en tu harem._" : "Reclámalo con *.claim* (30 s).")
      );
    }
  },
  {
    name: "claim",
    aliases: ["reclamar"],
    category: "gacha",
    desc: "Reclama el personaje que acaba de salir.",
    run: async ({ reply, chat, msg, store }) => {
      const sorteo = ultimoSorteo.get(chat);
      if (!sorteo) return reply("🍅 No hay nadie sorteado. Usa .rollwaifu primero.");
      if (Date.now() - sorteo.cuando > 30_000) {
        ultimoSorteo.delete(chat);
        return reply("🍅 Se pasó el tiempo para reclamarlo.");
      }
      const personaje = porId.get(sorteo.id);
      const usuario = store.usuario(msg.sender);
      if (usuario.gacha.reclamados.includes(personaje.id)) return reply("🍅 Ya lo tienes.");
      usuario.gacha.reclamados.push(personaje.id);
      usuario.gacha.seleccionado = personaje.id;
      store.marcar();
      ultimoSorteo.delete(chat);
      return reply(`🍅 Reclamaste a *${personaje.nombre}*. Ya está en tu harem.`);
    }
  },
  {
    name: "harem",
    aliases: ["miwaifus", "coliseo"],
    category: "gacha",
    desc: "Tu colección de personajes.",
    run: async ({ reply, store, msg }) => {
      const quien = msg.quoted?.participant || msg.sender;
      const usuario = store.usuario(quien);
      if (!usuario.gacha.reclamados.length) {
        return reply(`🍅 *${nombreCorto(quien)}* todavía no tiene a nadie. Usa .rollwaifu`);
      }
      const lista = usuario.gacha.reclamados.map((id) => {
        const p = porId.get(id);
        return p ? `· \`${p.id}\` ${p.nombre} ${estrellas(p.rareza)}` : null;
      }).filter(Boolean);
      return reply(`🍅 *Harem de ${nombreCorto(quien)}* (${lista.length})\n\n${lista.join("\n")}`);
    }
  },
  {
    name: "givechar",
    aliases: ["regalarpj"],
    category: "gacha",
    desc: "Regala un personaje a otra persona.",
    usage: "<@persona> <id>",
    run: async ({ reply, store, msg, args }) => {
      const quien = msg.quoted?.participant || msg.mentionedJid?.[0];
      const id = Number(args[args.length - 1]);
      if (!quien) return reply("🍅 Menciona o cita a quién se lo regalas.");
      const personaje = porId.get(id);
      if (!personaje) return reply("🍅 Ese id no existe. Míralos con .harem");
      const mio = store.usuario(msg.sender);
      if (!mio.gacha.reclamados.includes(id)) return reply("🍅 No tienes ese personaje.");
      mio.gacha.reclamados = mio.gacha.reclamados.filter((x) => x !== id);
      store.usuario(quien).gacha.reclamados.push(id);
      store.marcar();
      return reply(`🍅 Le regalaste a *${personaje.nombre}* a *${nombreCorto(quien)}*.`);
    }
  },
  {
    name: "giveallharem",
    category: "gacha",
    desc: "Regala toda tu colección a alguien (dueño).",
    owner: true,
    run: async ({ reply, store, msg, args }) => {
      const quien = msg.quoted?.participant || msg.mentionedJid?.[0];
      if (!quien) return reply("🍅 Menciona o cita a quién le pasas todo.");
      const mio = store.usuario(msg.sender);
      const suyo = store.usuario(quien);
      const cuantos = mio.gacha.reclamados.length;
      suyo.gacha.reclamados = [...new Set([...suyo.gacha.reclamados, ...mio.gacha.reclamados])];
      mio.gacha.reclamados = [];
      store.marcar();
      return reply(`🍅 Le pasaste *${cuantos}* personajes a *${nombreCorto(quien)}*.`);
    }
  },
  {
    name: "delchar",
    aliases: ["borrarpj"],
    category: "gacha",
    desc: "Borra un personaje de tu colección.",
    usage: "<id>",
    run: async ({ reply, store, msg, args }) => {
      const id = Number(args[0]);
      const usuario = store.usuario(msg.sender);
      if (!usuario.gacha.reclamados.includes(id)) return reply("🍅 No tienes ese personaje.");
      usuario.gacha.reclamados = usuario.gacha.reclamados.filter((x) => x !== id);
      store.marcar();
      return reply("🍅 Borrado de tu colección.");
    }
  },
  {
    name: "wshop",
    aliases: ["tiendagacha"],
    category: "gacha",
    desc: "Compra personajes con tomates.",
    usage: "[id]",
    run: async ({ reply, store, msg, args }) => {
      const id = Number(args[0]);
      if (!id) {
        const lista = catalogo
          .filter((p) => p.rareza >= 4)
          .map((p) => `· \`${p.id}\` ${p.nombre} ${estrellas(p.rareza)} — ${monedas(p.precio)}`)
          .join("\n");
        return reply(`🍅 *Tienda gacha*\n\n${lista}\n\nCompra con .wshop <id>`);
      }
      const personaje = porId.get(id);
      if (!personaje) return reply("🍅 Ese id no existe.");
      const usuario = store.usuario(msg.sender);
      if (usuario.gacha.reclamados.includes(id)) return reply("🍅 Ya lo tienes.");
      if (usuario.coins + usuario.banco < personaje.precio) {
        return reply(`🍅 Te faltan *${monedas(personaje.precio - (usuario.coins + usuario.banco))}*.`);
      }
      const total = usuario.coins + usuario.banco;
      store.sumarCoins(msg.sender, -(Math.min(usuario.coins, personaje.precio)));
      if (personaje.precio > usuario.coins) {
        usuario.banco -= personaje.precio - Math.min(total, personaje.precio);
      }
      usuario.gacha.reclamados.push(id);
      store.marcar();
      return reply(`🍅 Compraste a *${personaje.nombre}*.`);
    }
  },
  {
    name: "vote",
    aliases: ["votar"],
    category: "gacha",
    desc: "Vota por el personaje de la semana.",
    run: async ({ reply, store, chat }) => {
      const votos = store.chat(chat).votos || {};
      const lista = catalogo.slice(0, 5);
      if (!Object.keys(votos).length) {
        const papeleta = lista.map((p) => `· \`${p.id}\` ${p.nombre}`).join("\n");
        return reply(`🍅 *Votación abierta*\n\n${papeleta}\n\nVota con .vote <id>`);
      }
      const ranking = Object.entries(votos)
        .sort((a, b) => b[1] - a[1])
        .map(([id, cuantos]) => `· ${porId.get(Number(id))?.nombre || id} — ${cuantos} votos`)
        .join("\n");
      return reply(`🍅 *Resultados*\n\n${ranking}`);
    }
  },
  {
    name: "setclaim",
    aliases: ["mensajeclaim"],
    category: "gacha",
    desc: "Cambia el mensaje que se manda al reclamar.",
    usage: "<texto>",
    run: async ({ reply, store, chat, text }) => {
      if (!text) return reply("🍅 Uso: .setclaim ¡Reclamé a {nombre}!");
      store.chat(chat).claimMsg = text.slice(0, 200);
      store.marcar();
      return reply(`🍅 Mensaje de reclamo guardado: _${text.slice(0, 200)}_`);
    }
  },
  {
    name: "infogacha",
    aliases: ["gachainfo"],
    category: "gacha",
    desc: "Cuántos personajes hay y cómo se reparten.",
    run: async ({ reply }) => {
      const cuenta = new Map();
      for (const p of catalogo) cuenta.set(p.rareza, (cuenta.get(p.rareza) || 0) + 1);
      const filas = [...cuenta.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([rareza, cuantos]) => `· ${"★".repeat(rareza)} — ${numero(cuantos)}`)
        .join("\n");
      return reply(`🍅 *Gacha*\n\n· Total: *${numero(catalogo.length)}*\n${filas}`);
    }
  }
];
