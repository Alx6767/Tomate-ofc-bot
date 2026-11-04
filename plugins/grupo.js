/**
 * Tomate ofc bot — administración de grupos.
 *
 * Todos los comandos que cambian algo del grupo piden ser administrador y que
 * el bot también lo sea: WhatsApp rechaza la acción sin decirlo, así que se
 * comprueba antes para poder explicar el motivo.
 */

import { nombreCorto, recortar } from "../src/utils.js";

/** A quién apunta el comando: citado, mencionado o primer argumento. */
function objetivo(msg, args) {
  const citado = msg.quoted?.participant;
  if (citado) return citado;
  if (msg.mentionedJid?.length) return msg.mentionedJid[0];
  const digitos = String(args[0] || "").replace(/\D/g, "");
  return digitos ? `${digitos}@s.whatsapp.net` : null;
}

/** Ejecuta una acción sobre participantes. */
async function accion(sock, chat, quien, que) {
  try {
    await sock.groupParticipantsUpdate(chat, [quien], que);
    return true;
  } catch {
    return false;
  }
}

export default [
  {
    name: "kick",
    aliases: ["ban", "expulsar", "sacar"],
    category: "grupo",
    desc: "Expulsa a alguien del grupo.",
    usage: "<@persona>",
    group: true,
    admin: true,
    botAdmin: true,
    run: async ({ reply, sock, chat, msg, args }) => {
      const quien = objetivo(msg, args);
      if (!quien) return reply("🍅 Menciona o cita a quién expulsar.");
      const hecho = await accion(sock, chat, quien, "remove");
      return reply(hecho ? `🍅 *${nombreCorto(quien)}* fuera.` : "🍅 No pude expulsarlo (¿es administrador?).");
    }
  },
  {
    name: "promote",
    aliases: ["ascender", "admin"],
    category: "grupo",
    desc: "Da administración a alguien.",
    usage: "<@persona>",
    group: true,
    admin: true,
    botAdmin: true,
    run: async ({ reply, sock, chat, msg, args }) => {
      const quien = objetivo(msg, args);
      if (!quien) return reply("🍅 Menciona o cita a quién ascender.");
      const hecho = await accion(sock, chat, quien, "promote");
      return reply(hecho ? `🍅 *${nombreCorto(quien)}* ahora es administrador.` : "🍅 No pude ascenderlo.");
    }
  },
  {
    name: "demote",
    aliases: ["degradar", "quitaradmin"],
    category: "grupo",
    desc: "Quita la administración a alguien.",
    usage: "<@persona>",
    group: true,
    admin: true,
    botAdmin: true,
    run: async ({ reply, sock, chat, msg, args }) => {
      const quien = objetivo(msg, args);
      if (!quien) return reply("🍅 Menciona o cita a quién degradar.");
      const hecho = await accion(sock, chat, quien, "demote");
      return reply(hecho ? `🍅 *${nombreCorto(quien)}* ya no es administrador.` : "🍅 No pude degradarlo.");
    }
  },
  {
    name: "close",
    aliases: ["cerrar"],
    category: "grupo",
    desc: "Cierra el grupo: solo administradores escriben.",
    group: true,
    admin: true,
    botAdmin: true,
    run: async ({ reply, sock, chat }) => {
      await sock.groupSettingUpdate(chat, "announcement").catch(() => {});
      return reply("🍅 Grupo cerrado: solo administradores pueden escribir.");
    }
  },
  {
    name: "open",
    aliases: ["abrir"],
    category: "grupo",
    desc: "Abre el grupo para que todos escriban.",
    group: true,
    admin: true,
    botAdmin: true,
    run: async ({ reply, sock, chat }) => {
      await sock.groupSettingUpdate(chat, "not_announcement").catch(() => {});
      return reply("🍅 Grupo abierto: ya pueden escribir todos.");
    }
  },
  {
    name: "link",
    aliases: ["enlace", "invite"],
    category: "grupo",
    desc: "Muestra el enlace de invitación del grupo.",
    group: true,
    admin: true,
    botAdmin: true,
    run: async ({ reply, sock, chat }) => {
      try {
        const codigo = await sock.groupInviteCode(chat);
        return reply(`🍅 *Enlace del grupo*\nhttps://chat.whatsapp.com/${codigo}`);
      } catch {
        return reply("🍅 No pude obtener el enlace.");
      }
    }
  },
  {
    name: "resetlink",
    aliases: ["revoke"],
    category: "grupo",
    desc: "Anula el enlace actual y crea uno nuevo.",
    group: true,
    admin: true,
    botAdmin: true,
    run: async ({ reply, sock, chat }) => {
      try {
        const codigo = await sock.groupRevokeInvite(chat);
        return reply(`🍅 Enlace nuevo:\nhttps://chat.whatsapp.com/${codigo}`);
      } catch {
        return reply("🍅 No pude reiniciar el enlace.");
      }
    }
  },
  {
    name: "tag",
    aliases: ["todos", "all", "mencionar"],
    category: "grupo",
    desc: "Menciona a todos los del grupo.",
    usage: "[mensaje]",
    group: true,
    admin: true,
    run: async ({ reply, sock, chat, participants, text }) => {
      const gente = participants.map((p) => p.id).filter(Boolean);
      if (!gente.length) return reply("🍅 No pude leer los participantes.");
      const mencion = gente.map((jid) => `@${nombreCorto(jid)}`).join(" ");
      await sock.sendMessage(chat, {
        text: `${text ? recortar(text, 300) + "\n\n" : ""}${mencion}`,
        mentions: gente
      });
      return true;
    }
  },
  {
    name: "warn",
    aliases: ["advertir"],
    category: "grupo",
    desc: "Advierte a alguien. A las 3 advertencias se va del grupo.",
    usage: "<@persona> [motivo]",
    group: true,
    admin: true,
    run: async ({ reply, store, sock, chat, msg, args }) => {
      const quien = objetivo(msg, args);
      if (!quien) return reply("🍅 Menciona o cita a quién advertir.");
      const ajustes = store.chat(chat);
      ajustes.warns = ajustes.warns || {};
      const previas = ajustes.warns[quien]?.length || 0;
      const motivo = args.slice(1).join(" ") || "sin motivo";
      ajustes.warns[quien] = [...(ajustes.warns[quien] || []), { motivo, cuando: Date.now() }];
      store.marcar();
      const total = previas + 1;
      if (total >= 3) {
        const hecho = await accion(sock, chat, quien, "remove");
        delete ajustes.warns[quien];
        store.marcar();
        return reply(
          hecho
            ? `🍅 *${nombreCorto(quien)}* llegó a 3 advertencias y salió del grupo.`
            : `🍅 *${nombreCorto(quien)}* llegó a 3 advertencias, pero no pude expulsarlo.`
        );
      }
      return reply(`🍅 *${nombreCorto(quien)}* advertido (${total}/3): ${motivo}`);
    }
  },
  {
    name: "warns",
    aliases: ["advertencias"],
    category: "grupo",
    desc: "Lista las advertencias del grupo.",
    group: true,
    run: async ({ reply, store, chat }) => {
      const warns = store.chat(chat).warns || {};
      const filas = Object.entries(warns).map(
        ([quien, lista]) => `· ${nombreCorto(quien)}: *${lista.length}/3* — ${lista.map((w) => w.motivo).join("; ")}`
      );
      return reply(filas.length ? `🍅 *Advertencias*\n\n${filas.join("\n")}` : "🍅 No hay advertencias.");
    }
  },
  {
    name: "delwarn",
    aliases: ["quitarwarn"],
    category: "grupo",
    desc: "Quita las advertencias de alguien.",
    usage: "<@persona>",
    group: true,
    admin: true,
    run: async ({ reply, store, chat, msg, args }) => {
      const quien = objetivo(msg, args);
      if (!quien) return reply("🍅 Menciona o cita a quién perdonar.");
      const ajustes = store.chat(chat);
      if (!ajustes.warns?.[quien]) return reply("🍅 Esa persona no tiene advertencias.");
      delete ajustes.warns[quien];
      store.marcar();
      return reply(`🍅 Advertencias de *${nombreCorto(quien)}* borradas.`);
    }
  },
  {
    name: "del",
    aliases: ["borrar"],
    category: "grupo",
    desc: "Borra el mensaje citado.",
    group: true,
    admin: true,
    botAdmin: true,
    run: async ({ reply, sock, chat, msg }) => {
      const citado = msg.quoted?.stanzaId;
      if (!citado) return reply("🍅 Cita el mensaje que quieres borrar.");
      try {
        await sock.sendMessage(chat, {
          delete: {
            remoteJid: chat,
            fromMe: false,
            id: citado,
            participant: msg.quoted.participant
          }
        });
        return true;
      } catch {
        return reply("🍅 No pude borrarlo.");
      }
    }
  },
  {
    name: "antilink",
    aliases: ["antienlace"],
    category: "grupo",
    desc: "Enciende o apaga el anti-enlace del grupo.",
    usage: "<on|off>",
    group: true,
    admin: true,
    run: async ({ reply, store, chat, text }) => {
      const valor = text.trim().toLowerCase();
      if (!["on", "off"].includes(valor)) {
        const actual = store.chat(chat).antilink !== false;
        return reply(`🍅 Anti-enlace: *${actual ? "encendido" : "apagado"}*. Cambia con .antilink on|off`);
      }
      store.chat(chat).antilink = valor === "on";
      store.marcar();
      return reply(`🍅 Anti-enlace *${valor === "on" ? "encendido" : "apagado"}*.`);
    }
  },
  {
    name: "antinu",
    aliases: ["antispam"],
    category: "grupo",
    desc: "Filtro de invitaciones: borra enlaces de canal y de «únete a mi grupo».",
    usage: "<on|off>",
    group: true,
    admin: true,
    botAdmin: true,
    run: async ({ reply, store, chat, text }) => {
      const valor = text.trim().toLowerCase();
      if (!["on", "off"].includes(valor)) {
        const actual = Boolean(store.chat(chat).antinu);
        return reply(`🍅 Filtro de invitaciones: *${actual ? "encendido" : "apagado"}*. Cambia con .antinu on|off`);
      }
      store.chat(chat).antinu = valor === "on";
      store.marcar();
      return reply(`🍅 Filtro de invitaciones *${valor === "on" ? "encendido" : "apagado"}*.`);
    }
  },
  {
    name: "autoadmin",
    aliases: ["autoascender"],
    category: "grupo",
    desc: "Da administrador automáticamente a quien entra al grupo.",
    usage: "<on|off>",
    group: true,
    admin: true,
    botAdmin: true,
    run: async ({ reply, store, chat, text }) => {
      const valor = text.trim().toLowerCase();
      if (!["on", "off"].includes(valor)) {
        const actual = Boolean(store.chat(chat).autoadmin);
        return reply(
          `🍅 Auto-administrador: *${actual ? "encendido" : "apagado"}*\n` +
            "Con esto encendido, cada persona que entre queda como administradora (o pierde el puesto, con off)."
        );
      }
      store.chat(chat).autoadmin = valor === "on";
      store.marcar();
      return reply(`🍅 Auto-administrador *${valor === "on" ? "encendido" : "apagado"}*.`);
    }
  },
  {
    name: "bienvenida",
    aliases: ["welcome"],
    category: "grupo",
    desc: "Enciende o apaga el saludo a quien entra.",
    usage: "<on|off>",
    group: true,
    admin: true,
    run: async ({ reply, store, chat, text }) => {
      const valor = text.trim().toLowerCase();
      if (!["on", "off"].includes(valor)) {
        return reply(`🍅 Bienvenida: *${store.chat(chat).bienvenida ? "encendida" : "apagada"}*`);
      }
      store.chat(chat).bienvenida = valor === "on";
      store.marcar();
      return reply(`🍅 Bienvenida *${valor === "on" ? "encendida" : "apagada"}*.`);
    }
  },
  {
    name: "mute",
    aliases: ["silenciar"],
    category: "grupo",
    desc: "Silencia al bot en este chat (solo responde a admins y dueños).",
    usage: "<on|off>",
    group: true,
    admin: true,
    run: async ({ reply, store, chat, text }) => {
      const valor = text.trim().toLowerCase();
      if (!["on", "off"].includes(valor)) {
        return reply(`🍅 Bot silenciado: *${store.chat(chat).mute ? "sí" : "no"}*`);
      }
      store.chat(chat).mute = valor === "on";
      store.marcar();
      return reply(`🍅 Bot *${valor === "on" ? "silenciado" : "activo"}* en este grupo.`);
    }
  },
  {
    name: "infogrupo",
    aliases: ["ginfo"],
    category: "grupo",
    desc: "Datos del grupo: nombre, miembros y administradores.",
    group: true,
    run: async ({ reply, groupMetadata, participants }) => {
      if (!groupMetadata) return reply("🍅 No pude leer los datos del grupo.");
      const admins = participants.filter((p) => p.admin).map((p) => nombreCorto(p.id));
      return reply(
        `🍅 *${groupMetadata.subject || "Grupo"}*\n\n` +
          `· Miembros: *${participants.length}*\n` +
          `· Administradores: *${admins.length}*\n` +
          `· Descripción: ${recortar(groupMetadata.desc || "—", 200)}`
      );
    }
  }
];
