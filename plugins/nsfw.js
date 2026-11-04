/**
 * Tomate ofc bot — contenido adulto.
 *
 * Todo este archivo está apagado por defecto: sin `NSFW=true` en el `.env`,
 * los comandos responden que están desactivados. Además, el bot avisa siempre
 * de lo mismo, porque es verdad:
 *
 *   · Solo se hace una búsqueda en un tablero público (Rule34) y se manda la
 *     imagen que ese servicio devuelve.
 *   · xvideos y xnxx NO están integrados: no hay API pública y el bot no va a
 *     fingir que descarga de ahí. Devuelve el enlace de búsqueda y ya.
 *   · El bot no comprueba la edad de nadie; quien lo encienda asume que su
 *     grupo es de adultos.
 */

import { pedirJson, recortar } from "../src/utils.js";

/** Etiquetas habituales para que la búsqueda no salga vacía. */
const POR_DEFECTO = "rating:explicit";

export default [
  {
    name: "nsfw",
    category: "nsfw",
    desc: "Explica cómo se enciende el contenido adulto.",
    run: async ({ reply, config }) => {
      return reply(
        `🍅 *Contenido adulto*\n\n` +
          `· Estado: *${config.nsfw ? "encendido" : "apagado"}*\n` +
          (config.nsfw
            ? "· Los comandos .r34, .xnxx y .xvideos están disponibles en este chat.\n" +
              "· En grupos hace falta que un administrador lo permita en su grupo."
            : "· Para encenderlo, añade `NSFW=true` al archivo `.env` y reinicia.\n" +
              "· Solo úsalo en grupos de adultos y bajo tu responsabilidad.")
      );
    }
  },
  {
    name: "r34",
    aliases: ["rule34"],
    category: "nsfw",
    desc: "Busca una imagen en Rule34 (solo con NSFW activado).",
    usage: "<etiquetas>",
    nsfw: true,
    group: true,
    run: async ({ reply, send, chat, text }) => {
      const etiquetas = (text.trim() || POR_DEFECTO).replace(/\s+/g, "+");
      try {
        const datos = await pedirJson(
          `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&limit=1&tags=${encodeURIComponent(etiquetas)}`
        );
        const post = Array.isArray(datos) ? datos[0] : null;
        if (!post?.file_url) return reply("🍅 Sin resultados para esas etiquetas.");
        await send(chat, { image: { url: post.file_url }, caption: "🍅 Rule34" });
        return true;
      } catch (error) {
        return reply(`🍅 No pude buscar: ${recortar(error.message, 140)}`);
      }
    }
  },
  {
    name: "xnxx",
    category: "nsfw",
    desc: "Enlace de búsqueda en xnxx (el bot no descarga de ahí).",
    usage: "<búsqueda>",
    nsfw: true,
    group: true,
    run: async ({ reply, text }) => {
      const consulta = text.trim();
      if (!consulta) return reply("🍅 ¿Qué quieres buscar?");
      return reply(
        `🍅 *xnxx* no está integrado: no tiene API pública y no voy a fingir que descargo de ahí.\n\n` +
          `Búsqueda directa: https://www.xnxx.com/search/${encodeURIComponent(consulta)}`
      );
    }
  },
  {
    name: "xvideos",
    category: "nsfw",
    desc: "Enlace de búsqueda en xvideos (el bot no descarga de ahí).",
    usage: "<búsqueda>",
    nsfw: true,
    group: true,
    run: async ({ reply, text }) => {
      const consulta = text.trim();
      if (!consulta) return reply("🍅 ¿Qué quieres buscar?");
      return reply(
        `🍅 *xvideos* no está integrado: no tiene API pública y no voy a fingir que descargo de ahí.\n\n` +
          `Búsqueda directa: https://www.xvideos.com/?k=${encodeURIComponent(consulta)}`
      );
    }
  }
];
