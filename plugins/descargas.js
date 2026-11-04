/**
 * Tomate ofc bot — descargas.
 *
 * Se usan tres familias de comandos:
 *
 *   · YouTube (play, play2, ytinfo): buscan con `yt-search` y bajan con
 *     proveedores de API (vreden, btch), con yt-dlp como último recurso. Esto
 *     es lo que hace que funcione también en un servidor, donde yt-dlp solo
 *     recibe «Sign in to confirm you're not a bot».
 *   · yt-dlp directo (tiktok, instagram, facebook, pinterest). Si falta el
 *     programa, el comando lo dice y explica cómo instalarlo.
 *   · APIs públicas sin clave (danbooru, gelbooru, apk).
 */

import { descargar, hayYtdlp, info } from "../src/ytdlp.js";
import { archivo, buscar, datos as datosDe, fuentesDisponibles } from "../src/fuentes.js";
import { mandarBotones, deEnlace, deRespuesta } from "../src/botones.js";
import { monedas, pedirJson, recortar } from "../src/utils.js";

/** Aviso único para cuando falta yt-dlp. */
const SIN_YTDLP = "🍅 Falta *yt-dlp* para descargar.\n\nEn Termux:\n```pkg install python\npip install -U yt-dlp```";

/** Deja el título limpio para usarlo como nombre de archivo. */
const nombreDeArchivo = (titulo) =>
  String(titulo || "audio").replace(/[\\/:*?"<>|]+/g, "").trim().slice(0, 90) || "audio";

/** Etiqueta de duración en minutos:segundos. */
const reloj = (segundos) =>
  `${Math.floor((segundos || 0) / 60)}:${String((segundos || 0) % 60).padStart(2, "0")}`;

/**
 * Descarga un enlace o busca por texto y manda el audio o el vídeo.
 *
 * @param {object} ctx contexto del comando
 * @param {{audio: boolean}} opciones
 */
async function bajarYEnviar(ctx, { audio }) {
  const { reply, send, chat, text, sock, config, msg } = ctx;
  if (!text.trim()) {
    return reply(
      audio
        ? "🍅 Uso: *.play nombre de la canción* o *.play <enlace>*"
        : "🍅 Uso: *.play2 nombre del vídeo* o *.play2 <enlace>*"
    );
  }

  await reply(audio ? "🍅 Buscando y bajando el audio…" : "🍅 Buscando y bajando el vídeo…");

  let video;
  try {
    video = await buscar(text);
  } catch (error) {
    return reply(`🍅 ${recortar(error.message, 200)}`);
  }
  if (!video) {
    if (!(await hayYtdlp())) {
      return reply(`🍅 No encontré «${recortar(text, 60)}».\n\n_Sin *yt-search* instalado la búsqueda va coja: npm install_`);
    }
    try {
      video = { url: text.split(/\s+/)[0], titulo: text, autor: "", duracion: 0, vistas: 0, miniatura: "" };
    } catch {
      return reply("🍅 No encontré nada con ese nombre.");
    }
  }

  if (video.duracion > 60 * 25) {
    return reply(`🍅 Ese vídeo dura *${reloj(video.duracion)}*, demasiado largo para mandarlo por WhatsApp.`);
  }

  try {
    const { bytes, proveedor } = await archivo(video, { audio });
    const pie =
      `🍅 *${recortar(video.titulo, 120)}*\n` +
      (video.autor ? `· ${video.autor}\n` : "") +
      (video.duracion ? `· Duración: *${reloj(video.duracion)}*\n` : "") +
      `· Fuente: *${proveedor}*`;

    if (audio) {
      await send(chat, {
        audio: bytes,
        mimetype: "audio/mpeg",
        ptt: false,
        fileName: `${nombreDeArchivo(video.titulo)}.mp3`
      });
      await reply(pie);
    } else {
      await send(chat, { video: bytes, caption: pie, mimetype: "video/mp4" });
    }
    return true;
  } catch (error) {
    return reply(`🍅 No pude descargarlo: ${recortar(error.message, 300)}`);
  }
}

/**
 * Manda la ficha del vídeo con botones para elegir qué bajar.
 * Si el cliente no acepta botones, llega el mismo texto numerado.
 */
async function fichaConBotones({ sock, chat, reply, msg, config, text, audio }) {
  if (!text.trim()) return reply("🍅 ¿Qué busco? Ejemplo: *.play me atrapaste*");

  let video;
  try {
    video = await buscar(text);
  } catch (error) {
    return reply(`🍅 ${recortar(error.message, 200)}`);
  }
  if (!video) return reply(`🍅 No encontré «${recortar(text, 60)}».`);

  const detalle =
    `*${recortar(video.titulo, 120)}*\n` +
    (video.autor ? `· Canal: ${video.autor}\n` : "") +
    `· Duración: *${reloj(video.duracion)}*\n` +
    (video.vistas ? `· Vistas: *${monedas(video.vistas)}*\n` : "");

  const salio = await mandarBotones(
    sock,
    chat,
    {
      titulo: audio ? "🎧 Audio" : "🎬 Vídeo",
      texto: detalle,
      pie: config.nombre,
      botones: [
        deRespuesta("🎧 Bajar audio", `.play ${video.url}`),
        deRespuesta("🎬 Bajar vídeo", `.play2 ${video.url}`),
        deEnlace("🔗 Abrir en YouTube", video.url)
      ]
    },
    { quoted: msg?.raw }
  );

  if (!salio) {
    // El respaldo ya se mandó como texto: se recuerda cómo seguir.
    await reply(`🍅 Para bajarlo: *.play ${video.url}* o *.play2 ${video.url}*`);
  }
  return true;
}

export default [
  {
    name: "play",
    aliases: ["yt", "musica"],
    category: "descargas",
    desc: "Busca una canción y manda el audio.",
    usage: "<nombre o enlace>",
    run: async (ctx) => bajarYEnviar(ctx, { audio: true })
  },
  {
    name: "play2",
    aliases: ["video", "ytvideo"],
    category: "descargas",
    desc: "Busca un vídeo y lo manda completo.",
    usage: "<nombre o enlace>",
    run: async (ctx) => bajarYEnviar(ctx, { audio: false })
  },
  {
    name: "yts",
    aliases: ["buscaryt", "playsearch"],
    category: "descargas",
    desc: "Busca en YouTube y ofrece los botones de audio o vídeo.",
    usage: "<búsqueda>",
    run: async (ctx) => fichaConBotones({ ...ctx, audio: true })
  },
  {
    name: "ytinfo",
    aliases: ["info2"],
    category: "descargas",
    desc: "Muestra los datos de un vídeo sin descargarlo.",
    usage: "<enlace>",
    run: async ({ reply, text }) => {
      if (!text) return reply("🍅 Pásame el enlace o el nombre.");
      try {
        const video = await datosDe(text);
        const fuentes = await fuentesDisponibles();
        return reply(
          `🍅 *${recortar(video.titulo, 120)}*\n\n` +
            `· Autor: *${video.autor || "—"}*\n` +
            `· Duración: *${reloj(video.duracion)}*\n` +
            `· Vistas: *${Number(video.vistas || 0).toLocaleString("es-MX")}*\n` +
            `· Fuentes: *${fuentes.join(", ") || "ninguna"}*`
        );
      } catch (error) {
        return reply(`🍅 No pude leerlo: ${recortar(error.message, 200)}`);
      }
    }
  },
  {
    name: "tiktok",
    aliases: ["tt"],
    category: "descargas",
    desc: "Descarga un vídeo de TikTok.",
    usage: "<enlace>",
    run: async (ctx) => bajarYEnviar({ ...ctx, audio: false })
  },
  {
    name: "instagram",
    aliases: ["ig"],
    category: "descargas",
    desc: "Descarga un post o reel de Instagram.",
    usage: "<enlace>",
    run: async (ctx) => bajarYEnviar({ ...ctx, audio: false })
  },
  {
    name: "facebook",
    aliases: ["fb"],
    category: "descargas",
    desc: "Descarga un vídeo de Facebook.",
    usage: "<enlace>",
    run: async (ctx) => bajarYEnviar({ ...ctx, audio: false })
  },
  {
    name: "pinterest",
    aliases: ["pin"],
    category: "descargas",
    desc: "Descarga una imagen de Pinterest.",
    usage: "<enlace>",
    run: async ({ reply, send, chat, text }) => {
      if (!/^https?:\/\//i.test(text)) return reply("🍅 Pásame el enlace del pin.");
      try {
        // Pinterest deja una imagen principal en el HTML; se toma la de mayor tamaño.
        const html = await (await fetch(text, { headers: { "user-agent": "Mozilla/5.0" } })).text();
        const encontrada = html.match(/https:\/\/i\.pinimg\.com\/originals\/[^"'\s]+/);
        if (!encontrada) throw new Error("no encontré la imagen en ese enlace");
        await send(chat, { image: { url: encontrada[0] }, caption: "🍅 Pinterest" });
        return true;
      } catch (error) {
        return reply(`🍅 No pude bajarla: ${recortar(error.message, 160)}`);
      }
    }
  },
  {
    name: "danbooru",
    category: "descargas",
    desc: "Busca una imagen en Danbooru (solo contenido seguro).",
    usage: "<etiquetas>",
    run: async ({ reply, send, chat, text }) => {
      const etiquetas = `${text.trim() || "cat"} rating:general`.trim();
      try {
        const datos = await pedirJson(
          `https://danbooru.donmai.us/posts.json?limit=1&tags=${encodeURIComponent(etiquetas)}`
        );
        const post = Array.isArray(datos) ? datos[0] : null;
        if (!post?.file_url) throw new Error("sin resultados para esas etiquetas");
        await send(chat, { image: { url: post.file_url }, caption: `🍅 ${recortar(etiquetas, 100)}` });
        return true;
      } catch (error) {
        return reply(`🍅 No encontré nada: ${recortar(error.message, 160)}`);
      }
    }
  },
  {
    name: "gelbooru",
    category: "descargas",
    desc: "Busca una imagen en Gelbooru (requiere NSFW activado).",
    usage: "<etiquetas>",
    nsfw: true,
    run: async ({ reply, send, chat, text }) => {
      const etiquetas = text.trim() || "rating:general";
      try {
        const datos = await pedirJson(
          `https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1&limit=1&tags=${encodeURIComponent(etiquetas)}`
        );
        const post = datos?.post?.[0];
        if (!post?.file_url) throw new Error("sin resultados para esas etiquetas");
        await send(chat, { image: { url: post.file_url }, caption: `🍅 ${recortar(etiquetas, 100)}` });
        return true;
      } catch (error) {
        return reply(`🍅 No encontré nada: ${recortar(error.message, 160)}`);
      }
    }
  },
  {
    name: "apk",
    category: "descargas",
    desc: "Busca una aplicación en Aptoide y manda el enlace de descarga.",
    usage: "<nombre>",
    run: async ({ reply, text }) => {
      if (!text) return reply("🍅 ¿Qué aplicación buscas?");
      try {
        const datos = await pedirJson(
          `https://ws75.aptoide.com/api/7/apps/search?query=${encodeURIComponent(text)}&limit=1`
        );
        const app = datos?.datalist?.list?.[0];
        if (!app) return reply(`🍅 No encontré «${text}» en Aptoide.`);
        return reply(
          `🍅 *${app.name}*\n\n· Paquete: \`${app.package}\`\n· Versión: *${app.file?.vername || "—"}*\n` +
            `· Descarga: ${app.file?.path || app.store?.app_website || "no disponible"}`
        );
      } catch (error) {
        return reply(`🍅 No pude buscar: ${recortar(error.message, 160)}`);
      }
    }
  }
];
