/**
 * Tomate ofc bot — comandos útiles.
 *
 * Ninguno depende de una API de pago. Los que usan un servicio externo
 * (acortador, clima, traductor) avisan con el motivo cuando el servicio no
 * responde, en vez de quedarse callados.
 */

import { calcular } from "../src/calc.js";
import { aSticker, aImagen, aNotaDeVoz, hayFfmpeg } from "../src/media.js";
import { config } from "../src/config.js";
import { contarPalabras } from "../src/extra.js";
import { fecha, hora, numero, partir, pedirBytes, pedirJson, recortar } from "../src/utils.js";

/** Fuentes unicode para `fuente`. */
const FUENTES = {
  negrita: (t) => t.replace(/[A-Za-z0-9]/g, (c) => {
    const codigo = c.codePointAt(0);
    if (codigo >= 65 && codigo <= 90) return String.fromCodePoint(0x1d5d4 + (codigo - 65));
    if (codigo >= 97 && codigo <= 122) return String.fromCodePoint(0x1d5ee + (codigo - 97));
    return String.fromCodePoint(0x1d7ce + (codigo - 48));
  }),
  cursiva: (t) => t.replace(/[A-Za-z]/g, (c) => {
    const codigo = c.codePointAt(0);
    if (codigo >= 65 && codigo <= 90) return String.fromCodePoint(0x1d608 + (codigo - 65));
    return String.fromCodePoint(0x1d622 + (codigo - 97));
  }),
  mono: (t) => t.replace(/[A-Za-z0-9]/g, (c) => {
    const codigo = c.codePointAt(0);
    if (codigo >= 65 && codigo <= 90) return String.fromCodePoint(0x1d670 + (codigo - 65));
    if (codigo >= 97 && codigo <= 122) return String.fromCodePoint(0x1d68a + (codigo - 97));
    return String.fromCodePoint(0x1d7f6 + (codigo - 48));
  }),
  doble: (t) => t.replace(/[A-Za-z0-9]/g, (c) => {
    const codigo = c.codePointAt(0);
    if (codigo >= 65 && codigo <= 90) return String.fromCodePoint(0x1d538 + (codigo - 65));
    if (codigo >= 97 && codigo <= 122) return String.fromCodePoint(0x1d552 + (codigo - 97));
    return String.fromCodePoint(0x1d7d8 + (codigo - 48));
  }),
  circulo: (t) => t.replace(/[A-Za-z]/g, (c) => {
    const mayus = c === c.toUpperCase();
    const base = mayus ? 0x24b6 : 0x24d0;
    return String.fromCodePoint(base + (c.toUpperCase().codePointAt(0) - 65));
  })
};

export default [
  {
    name: "calc",
    aliases: ["calcular", "mate"],
    category: "utils",
    desc: "Calcula una operación sin usar eval.",
    usage: "<expresión>",
    run: async ({ reply, text }) => {
      if (!text) return reply("🍅 Uso: .calc 2+2*3 · admite sqrt, sin, cos, pi, paréntesis…");
      try {
        return reply(`🍅 *${text}* = *${numero(calcular(text))}*`);
      } catch (error) {
        return reply(`🍅 No pude calcularlo: ${error.message}`);
      }
    }
  },
  {
    name: "contar",
    category: "utils",
    desc: "Cuenta caracteres, palabras y líneas de un texto.",
    usage: "<texto>",
    run: async ({ reply, text }) => {
      if (!text) return reply("🍅 Escríbeme algo después del comando y te lo cuento.");
      const datos = contarPalabras(text);
      return reply(
        `🍅 *Conteo*\n\n` +
          `· Caracteres: *${numero(datos.caracteres)}*\n` +
          `· Sin espacios: *${numero(datos.sinEspacios)}*\n` +
          `· Palabras: *${numero(datos.palabras)}*\n` +
          `· Líneas: *${numero(datos.lineas)}*`
      );
    }
  },
  {
    name: "hora",
    aliases: ["fecha"],
    category: "utils",
    desc: "Hora y fecha actuales del bot.",
    run: async ({ reply }) => {
      return reply(
        `🍅 *Reloj*\n\n` +
          `· Hora: *${hora()}*\n` +
          `· Fecha: *${fecha(undefined, { dateStyle: "full" })}*\n` +
          `· Zona: *${config.zona}*`
      );
    }
  },
  {
    name: "reverse",
    aliases: ["alreves"],
    category: "utils",
    desc: "Devuelve el texto al revés.",
    usage: "<texto>",
    run: async ({ reply, text }) => {
      if (!text) return reply("🍅 Escribe el texto que quieres al revés.");
      return reply(`🍅 ${[...text].reverse().join("")}`);
    }
  },
  {
    name: "damelid",
    aliases: ["lid"],
    category: "utils",
    desc: "Identificador de quien escribió o del citado.",
    run: async ({ reply, msg }) => {
      const citado = msg.quoted?.participant;
      return reply(
        `🍅 *Identificador*\n\n` +
          `· Tú: \`${msg.sender}\`\n` +
          (citado ? `· Citado: \`${citado}\`` : "· Cita un mensaje para ver el suyo.")
      );
    }
  },
  {
    name: "fuente",
    aliases: ["letra"],
    category: "utils",
    desc: "Convierte texto a letras decorativas.",
    usage: "<estilo> <texto>",
    run: async ({ reply, text }) => {
      const { primero, resto } = partir(text);
      if (!primero) {
        return reply(`🍅 Estilos: ${Object.keys(FUENTES).join(", ")}\nEjemplo: .fuente negrita hola`);
      }
      const estilo = FUENTES[primero.toLowerCase()];
      if (!estilo) return reply(`🍅 No existe el estilo *${primero}*. Hay: ${Object.keys(FUENTES).join(", ")}`);
      if (!resto) return reply("🍅 Falta el texto que quieres convertir.");
      return reply(estilo(resto));
    }
  },
  {
    name: "acortar",
    aliases: ["short"],
    category: "utils",
    desc: "Acorta un enlace con is.gd.",
    usage: "<url>",
    run: async ({ reply, text }) => {
      if (!/^https?:\/\//i.test(text)) return reply("🍅 Pásame un enlace que empiece por http:// o https://");
      try {
        const datos = await pedirJson(`https://is.gd/create.php?format=json&url=${encodeURIComponent(text)}`);
        if (!datos?.shorturl) throw new Error("el acortador no devolvió enlace");
        return reply(`🍅 *Enlace corto*\n${datos.shorturl}`);
      } catch (error) {
        return reply(`🍅 No pude acortarlo: ${recortar(error.message, 120)}`);
      }
    }
  },
  {
    name: "encuesta",
    aliases: ["poll"],
    category: "utils",
    desc: "Crea una encuesta nativa. Separa las opciones con |",
    usage: "<pregunta> | <opción 1> | <opción 2>",
    run: async ({ reply, text, send, chat }) => {
      const partes = text.split("|").map((p) => p.trim()).filter(Boolean);
      if (partes.length < 3) {
        return reply("🍅 Uso: .encuesta ¿Pizza o tacos? | Pizza | Tacos");
      }
      const [pregunta, ...opciones] = partes;
      await send(chat, {
        poll: {
          name: recortar(pregunta, 200),
          values: opciones.slice(0, 12).map((o) => recortar(o, 80)),
          selectableCount: 1
        }
      });
      return true;
    }
  },
  {
    name: "hd",
    aliases: ["alta"],
    category: "utils",
    desc: "Reenvía una imagen como archivo para que no la comprima WhatsApp.",
    run: async ({ reply, descargar, send, chat, msg }) => {
      if (!msg.quoted && !msg.mediaType.includes("image")) {
        return reply("🍅 Cita una imagen y usa .hd para recibirla sin compresión.");
      }
      try {
        const bytes = await descargar("image");
        await send(chat, {
          document: bytes,
          mimetype: "image/jpeg",
          fileName: `tomate-hd-${Date.now()}.jpg`
        });
        return true;
      } catch (error) {
        return reply(`🍅 No pude sacarla: ${recortar(error.message, 120)}`);
      }
    }
  },
  {
    name: "s",
    aliases: ["sticker"],
    category: "utils",
    desc: "Convierte una imagen o un vídeo citado en sticker.",
    run: async ({ reply, descargar, send, chat, msg }) => {
      const hay = msg.mediaType || msg.quoted?.quotedMessage;
      if (!hay) return reply("🍅 Cita una imagen, un vídeo o un sticker.");
      if (!(await hayFfmpeg())) return reply("🍅 Falta ffmpeg. En Termux: pkg install ffmpeg");
      try {
        const esVideo = msg.mediaType === "videoMessage" || Boolean(msg.quoted?.quotedMessage?.videoMessage);
        const bytes = await descargar(esVideo ? "video" : "image");
        const sticker = await aSticker(bytes, { video: esVideo, author: msg.pushName });
        await send(chat, { sticker });
        return true;
      } catch (error) {
        return reply(`🍅 No pude hacer el sticker: ${recortar(error.message, 120)}`);
      }
    }
  },
  {
    name: "toimg",
    aliases: ["toimage"],
    category: "utils",
    desc: "Convierte un sticker en imagen.",
    run: async ({ reply, descargar, send, chat, msg }) => {
      const esSticker = msg.mediaType === "stickerMessage" || Boolean(msg.quoted?.quotedMessage?.stickerMessage);
      if (!esSticker) return reply("🍅 Cita un sticker y usa .toimg");
      if (!(await hayFfmpeg())) return reply("🍅 Falta ffmpeg. En Termux: pkg install ffmpeg");
      try {
        const bytes = await descargar("sticker");
        const png = await aImagen(bytes);
        await send(chat, { image: png });
        return true;
      } catch (error) {
        return reply(`🍅 No pude convertirlo: ${recortar(error.message, 120)}`);
      }
    }
  },
  {
    name: "voz",
    aliases: ["tts"],
    category: "utils",
    desc: "Convierte texto en nota de voz.",
    usage: "<texto>",
    run: async ({ reply, text, send, chat }) => {
      if (!text) return reply("🍅 Escribe lo que quieres que diga.");
      if (!(await hayFfmpeg())) return reply("🍅 Falta ffmpeg para armar la nota de voz.");
      try {
        const url =
          "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=es&q=" +
          encodeURIComponent(recortar(text, 190));
        const mp3 = await pedirBytes(url, { tiempo: 20000 });
        const ogg = await aNotaDeVoz(mp3);
        await send(chat, { audio: ogg, mimetype: "audio/ogg; codecs=opus", ptt: true });
        return true;
      } catch (error) {
        return reply(`🍅 No pude generar la voz: ${recortar(error.message, 120)}`);
      }
    }
  },
  {
    name: "inspect",
    category: "utils",
    desc: "Muestra el contenido crudo del mensaje citado (solo dueño).",
    owner: true,
    run: async ({ reply, msg }) => {
      const citado = msg.quoted?.quotedMessage;
      if (!citado) return reply("🍅 Cita un mensaje y usa .inspect");
      return reply("```" + recortar(JSON.stringify(citado, null, 1), 3000) + "```");
    }
  }
];
