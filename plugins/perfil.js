/**
 * Tomate ofc bot — perfil, pareja y familia.
 *
 * Todo lo que se guarda aquí es texto que escribe el propio usuario. No se
 * valida más allá de recortar el largo, porque es su ficha y no se usa para
 * nada crítico.
 */

import { elegir, monedas, nombreCorto, recortar } from "../src/utils.js";

/** Campos editables de la ficha. */
const CAMPOS = {
  desc: { etiqueta: "Descripción", max: 300 },
  birth: { etiqueta: "Cumpleaños", max: 20 },
  edad: { etiqueta: "Edad", max: 3 },
  genero: { etiqueta: "Género", max: 30 },
  hobby: { etiqueta: "Hobby", max: 80 }
};

/** Pinta la ficha completa de alguien. */
export function ficha(usuario, jid) {
  const p = usuario.perfil || {};
  const filas = [
    `· Nombre: *${nombreCorto(jid)}*`,
    `· Descripción: ${p.desc ? recortar(p.desc, 300) : "—"}`,
    `· Cumpleaños: ${p.cumple || "—"}`,
    `· Edad: ${p.edad || "—"}`,
    `· Género: ${p.genero || "—"}`,
    `· Hobby: ${p.hobby || "—"}`,
    `· Nivel: *${usuario.nivel}*`,
    `· Tomates: *${monedas(usuario.coins + usuario.banco)}*`,
    `· Pareja: ${usuario.pareja ? nombreCorto(usuario.pareja) : "—"}`,
    `· Familia: ${usuario.familia ? nombreCorto(usuario.familia) : "—"}`
  ];
  return `🍅 *Perfil*\n\n${filas.join("\n")}`;
}

export default [
  {
    name: "perfil",
    aliases: ["profile", "yo"],
    category: "perfil",
    desc: "Tu ficha o la de la persona que cites.",
    run: async ({ reply, store, msg }) => {
      const quien = msg.quoted?.participant || msg.sender;
      return reply(ficha(store.usuario(quien), quien));
    }
  },
  {
    name: "marry",
    aliases: ["casar"],
    category: "perfil",
    desc: "Pide matrimonio a alguien del chat.",
    usage: "<@persona>",
    run: async ({ reply, store, msg, args }) => {
      const quien = msg.quoted?.participant || msg.mentionedJid?.[0] || (args[0] ? `${args[0].replace(/\D/g, "")}@s.whatsapp.net` : null);
      if (!quien || quien === msg.sender) return reply("🍅 Di con quién te quieres casar (mención o cita).");
      const mio = store.usuario(msg.sender);
      const suyo = store.usuario(quien);
      if (mio.pareja) return reply("🍅 Ya estás casado/a. Usa .divorce primero.");
      if (suyo.pareja) return reply(`🍅 *${nombreCorto(quien)}* ya está casado/a.`);
      if (suyo.propuesta === msg.sender) {
        mio.pareja = quien;
        suyo.pareja = msg.sender;
        suyo.propuesta = null;
        store.marcar();
        return reply(`🍅 ¡Se casaron! *${nombreCorto(msg.sender)}* y *${nombreCorto(quien)}*. 🎉`);
      }
      suyo.propuesta = msg.sender;
      store.marcar();
      return reply(
        `🍅 *${nombreCorto(msg.sender)}* le propone matrimonio a *${nombreCorto(quien)}*.\n` +
          `Si acepta, que escriba *.marry @${nombreCorto(msg.sender)}*`
      );
    }
  },
  {
    name: "divorce",
    aliases: ["divorcio"],
    category: "perfil",
    desc: "Termina tu matrimonio.",
    run: async ({ reply, store, msg }) => {
      const mio = store.usuario(msg.sender);
      if (!mio.pareja) return reply("🍅 No estás casado/a.");
      const otro = store.usuario(mio.pareja);
      otro.pareja = null;
      mio.pareja = null;
      store.marcar();
      return reply("🍅 Divorcio firmado. Cada quien por su lado.");
    }
  },
  {
    name: "adoptar",
    category: "perfil",
    desc: "Adopta a alguien como hijo/a del bot.",
    usage: "<@persona>",
    run: async ({ reply, store, msg }) => {
      const quien = msg.quoted?.participant || msg.mentionedJid?.[0];
      if (!quien || quien === msg.sender) return reply("🍅 Menciona o cita a quién quieres adoptar.");
      const mio = store.usuario(msg.sender);
      const suyo = store.usuario(quien);
      if (suyo.familia) return reply("🍅 Esa persona ya tiene familia.");
      mio.hijos = [...new Set([...(mio.hijos || []), quien])];
      suyo.familia = msg.sender;
      store.marcar();
      return reply(`🍅 *${nombreCorto(msg.sender)}* adoptó a *${nombreCorto(quien)}*.`);
    }
  },
  {
    name: "familia",
    aliases: ["fam"],
    category: "perfil",
    desc: "Muestra tu familia dentro del bot.",
    run: async ({ reply, store, msg }) => {
      const quien = msg.quoted?.participant || msg.sender;
      const usuario = store.usuario(quien);
      const hijos = (usuario.hijos || []).map((h) => nombreCorto(h));
      return reply(
        `🍅 *Familia de ${nombreCorto(quien)}*\n\n` +
          `· Pareja: ${usuario.pareja ? nombreCorto(usuario.pareja) : "—"}\n` +
          `· Padre/madre: ${usuario.familia ? nombreCorto(usuario.familia) : "—"}\n` +
          `· Hijos: ${hijos.length ? hijos.join(", ") : "—"}`
      );
    }
  },
  ...Object.entries(CAMPOS).map(([campo, info]) => ({
    name: `set${campo}`,
    // El menú pide los nombres en inglés para dos de ellos.
    aliases: campo === "genero" ? ["setgenre", "setgender"] : undefined,
    category: "perfil",
    desc: `Cambia tu ${info.etiqueta.toLowerCase()}.`,
    usage: `<valor>`,
    run: async ({ reply, store, msg, text }) => {
      if (!text) return reply(`🍅 Uso: .set${campo} <valor>`);
      const usuario = store.usuario(msg.sender);
      if (campo === "edad") {
        const edad = Number(text);
        if (!Number.isFinite(edad) || edad < 5 || edad > 120) return reply("🍅 Pon una edad entre 5 y 120.");
        usuario.perfil.edad = edad;
      } else if (campo === "birth") {
        usuario.perfil.cumple = recortar(text, info.max);
      } else {
        usuario.perfil[campo] = recortar(text, info.max);
      }
      store.marcar();
      return reply(`🍅 ${info.etiqueta}: *${recortar(text, info.max)}* guardado.`);
    }
  })),
  ...Object.keys(CAMPOS).map((campo) => ({
    name: `del${campo}`,
    aliases: campo === "genero" ? ["delgenre", "delgender"] : undefined,
    category: "perfil",
    desc: `Borra tu ${CAMPOS[campo].etiqueta.toLowerCase()}.`,
    run: async ({ reply, store, msg }) => {
      const usuario = store.usuario(msg.sender);
      const clave = campo === "birth" ? "cumple" : campo;
      usuario.perfil[clave] = campo === "edad" ? null : "";
      store.marcar();
      return reply(`🍅 ${CAMPOS[campo].etiqueta} borrado.`);
    }
  })),
  {
    name: "parejasdelgrupo",
    category: "perfil",
    desc: "Pinta un ramo de tomates para el grupo (adorno).",
    group: true,
    run: async ({ reply }) => reply(`🍅 ${elegir(["🌹", "🍅", "🌷"])} ${elegir(["con cariño", "para todos", "de parte del tomate"])}`)
  }
];
