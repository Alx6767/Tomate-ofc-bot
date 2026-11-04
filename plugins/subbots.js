/**
 * Tomate ofc bot — sub-bots y perfil del bot.
 *
 * Los sub-bots se conectan desde este mismo proceso (ver `src/subbots.js`).
 * Solo el dueño puede crearlos: cada uno es una cuenta de WhatsApp más.
 */

import fs from "node:fs";
import path from "node:path";
import { config, RAIZ } from "../src/config.js";
import { cerrar, crear, listar } from "../src/subbots.js";
import { duracion, nombreCorto, recortar } from "../src/utils.js";

/** Manda una imagen de la carpeta assets. */
async function mandarAsset({ send, chat, reply, archivo, pie }) {
  try {
    const ruta = path.join(RAIZ, "assets", archivo);
    if (!fs.existsSync(ruta)) return reply(`🍅 Falta el archivo assets/${archivo}`);
    await send(chat, { image: fs.readFileSync(ruta), caption: pie });
    return true;
  } catch (error) {
    return reply(`🍅 No pude mandarla: ${recortar(error.message, 120)}`);
  }
}

export default [
  {
    name: "code",
    aliases: ["subbot", "getcode"],
    category: "subbots",
    desc: "Crea un sub-bot y devuelve su código de vinculación.",
    usage: "<número>",
    owner: true,
    run: async ({ reply, args, registro, store }) => {
      const numero = (args[0] || "").replace(/\D/g, "");
      if (!numero) return reply("🍅 Uso: .code 5215512345678 (con código de país, sin +)");
      try {
        const { codigo } = await crear({ numero, registro: globalThis.__tomateRegistro || registro, store, codigo: "" });
        return reply(
          `🍅 *Sub-bot ${numero}*\n\n· Código: *${codigo}*\n\n` +
            "WhatsApp → Dispositivos vinculados → Vincular con número de teléfono."
        );
      } catch (error) {
        return reply(`🍅 No pude crearlo: ${recortar(error.message, 200)}`);
      }
    }
  },
  {
    name: "bots",
    aliases: ["subbots"],
    category: "subbots",
    desc: "Sub-bots conectados en este proceso.",
    run: async ({ reply }) => {
      const activos = listar();
      if (!activos.length) return reply("🍅 No hay sub-bots conectados ahora mismo.");
      const filas = activos
        .map((b) => `· ${b.numero} — ${b.conectado ? "conectado" : "desconectado"} · ${duracion(Date.now() - b.creado)}`)
        .join("\n");
      return reply(`🍅 *Sub-bots* (${activos.length})\n\n${filas}`);
    }
  },
  {
    name: "delbot",
    aliases: ["borrarsubbot"],
    category: "subbots",
    desc: "Desconecta un sub-bot y borra su sesión.",
    usage: "<número>",
    owner: true,
    run: async ({ reply, args }) => {
      const numero = (args[0] || "").replace(/\D/g, "");
      if (!numero) return reply("🍅 Dime qué sub-bot quitar.");
      const hecho = cerrar(numero, { borrarSesion: true });
      return reply(hecho ? `🍅 Sub-bot *${numero}* cerrado y su sesión borrada.` : "🍅 Ese sub-bot no está activo.");
    }
  },
  {
    name: "setmenu",
    category: "subbots",
    desc: "Cambia el encabezado del menú en este chat (dueño).",
    usage: "<texto|off>",
    owner: true,
    run: async ({ reply, store, chat, text }) => {
      if (!text.trim()) {
        const actual = store.chat(chat).menuTitulo;
        return reply(`🍅 Encabezado actual: ${actual ? `_${actual}_` : "*el de siempre*"}`);
      }
      if (text.trim().toLowerCase() === "off") {
        store.chat(chat).menuTitulo = "";
        store.marcar();
        return reply("🍅 Encabezado del menú restaurado.");
      }
      store.chat(chat).menuTitulo = recortar(text.trim(), 60);
      store.marcar();
      return reply(`🍅 Encabezado del menú: _${recortar(text.trim(), 60)}_`);
    }
  },
  {
    name: "setprimary",
    aliases: ["principal"],
    category: "subbots",
    desc: "Apunta cuál es el número principal del bot (se muestra en el menú).",
    usage: "[número]",
    owner: true,
    run: async ({ reply, store, text }) => {
      const numero = (text || "").replace(/\D/g, "");
      if (!numero) {
        const actual = store.global("principal") || config.dispositivo;
        return reply(`🍅 Número principal: *${actual}*`);
      }
      store.global("principal", numero);
      store.marcar();
      return reply(`🍅 Número principal: *${numero}*`);
    }
  },
  {
    name: "perfilbot",
    aliases: ["cuenta"],
    category: "subbots",
    desc: "Datos de la cuenta que está atendiendo este chat.",
    run: async ({ reply, sock }) => {
      return reply(
        `🍅 *Cuenta activa*\n\n· Número: *${nombreCorto(sock.user?.id)}*\n` +
          `· Nombre: *${sock.user?.name || config.dispositivo}*\n` +
          `· Plataforma: *${sock.user?.platform || "—"}*`
      );
    }
  },
  {
    name: "foto",
    aliases: ["mascota"],
    category: "subbots",
    desc: "Manda la mascota del bot.",
    run: async (ctx) => mandarAsset({ ...ctx, archivo: "mascota.png", pie: "🍅 Tomate ofc bot" })
  },
  {
    name: "setbanner",
    aliases: ["banner"],
    category: "subbots",
    desc: "Manda el banner del bot.",
    run: async (ctx) => mandarAsset({ ...ctx, archivo: "banner.jpg", pie: "🍅 Tomate ofc bot" })
  },
  {
    name: "setpfp",
    aliases: ["fotoperfil"],
    category: "subbots",
    desc: "Cambia la foto de perfil del bot con la imagen que cites (dueño).",
    owner: true,
    run: async ({ reply, sock, descargar, msg }) => {
      if (!msg.quoted?.quotedMessage?.imageMessage) return reply("🍅 Cita la imagen que quieres poner.");
      try {
        const bytes = await descargar("image");
        await sock.updateProfilePicture(sock.user.id, bytes);
        return reply("🍅 Foto de perfil actualizada.");
      } catch (error) {
        return reply(`🍅 No pude cambiarla: ${recortar(error.message, 140)}`);
      }
    }
  },
  {
    name: "setname",
    aliases: ["nombrebot"],
    category: "subbots",
    desc: "Cambia el nombre de la cuenta (dueño).",
    usage: "<nombre>",
    owner: true,
    run: async ({ reply, sock, text }) => {
      if (!text) return reply("🍅 ¿Qué nombre le pongo?");
      try {
        await sock.updateProfileName(recortar(text, 25));
        return reply(`🍅 Nombre cambiado a *${recortar(text, 25)}*.`);
      } catch (error) {
        return reply(`🍅 No pude cambiarlo: ${recortar(error.message, 140)}`);
      }
    }
  }
];
