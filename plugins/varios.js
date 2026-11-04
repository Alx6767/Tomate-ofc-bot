/**
 * Tomate ofc bot — comandos sueltos que no encajaban en otra categoría.
 *
 * Aquí están: el ahorcado de preguntas (akinator con árbol propio), plantar,
 * traducir, los dos de stickers con reacción y las búsquedas que no se pueden
 * hacer de verdad (Instagram y TikTok), que responden con el enlace en vez de
 * inventarse resultados.
 */

import fs from "node:fs";
import path from "node:path";
import { RAIZ, config } from "../src/config.js";
import { aSticker, hayFfmpeg } from "../src/media.js";
import { azar, elegir, monedas, pedirJson, recortar, simplificar } from "../src/utils.js";
import { calcular } from "../src/calc.js";

/** Partidas abiertas de akinator: chat → { candidatos, respuestas, de }. */
const partidas = new Map();

/** Preguntas del árbol: cada una filtra por una etiqueta. */
const PREGUNTAS = [
  { etiqueta: "humano", texto: "¿Es una persona?" },
  { etiqueta: "animal", texto: "¿Es un animal?" },
  { etiqueta: "vuela", texto: "¿Vuela?" },
  { etiqueta: "agua", texto: "¿Vive en el agua?" },
  { etiqueta: "ficcion", texto: "¿Es un personaje de ficción?" },
  { etiqueta: "come", texto: "¿Se puede comer?" }
];

/** Fichas del árbol. */
const FICHAS = [
  { nombre: "un perro", etiquetas: ["animal"] },
  { nombre: "un gato", etiquetas: ["animal"] },
  { nombre: "un águila", etiquetas: ["animal", "vuela"] },
  { nombre: "un delfín", etiquetas: ["animal", "agua"] },
  { nombre: "una manzana", etiquetas: ["come"] },
  { nombre: "un tomate", etiquetas: ["come"] },
  { nombre: "un avión", etiquetas: ["vuela"] },
  { nombre: "un barco", etiquetas: ["agua"] },
  { nombre: "Superman", etiquetas: ["ficcion", "vuela"] },
  { nombre: "un estudiante", etiquetas: ["humano"] },
  { nombre: "un programador", etiquetas: ["humano"] },
  { nombre: "una pizza", etiquetas: ["come"] }
];

/** Palabras que se aceptan como «sí» o como «no». */
const SI = ["si", "sí", "s", "yes", "1", "claro", "obvio"];
const NO = ["no", "n", "nel", "0"];

/** ¿El texto es un sí, un no o nada? */
function respuestaDe(texto) {
  const limpio = simplificar(texto);
  if (SI.includes(limpio)) return true;
  if (NO.includes(limpio)) return false;
  return null;
}

/** Traduce un texto con MyMemory (gratis y sin clave). */
async function traducirTexto(texto, destino) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(texto)}&langpair=es|${destino}`;
  const datos = await pedirJson(url, { tiempo: 12000 });
  const resultado = datos?.responseData?.translatedText;
  if (!resultado) throw new Error("el servicio no devolvió traducción");
  return String(resultado);
}

export default [
  {
    name: "math",
    aliases: ["mates", "resolver"],
    category: "juegos",
    desc: "Calculadora con el mismo motor que .calc.",
    usage: "<expresión>",
    run: async ({ reply, text }) => {
      if (!text) return reply("🍅 Uso: .math (12+8)*3");
      try {
        return reply(`🍅 *${text}* = *${calcular(text)}*`);
      } catch (error) {
        return reply(`🍅 No pude calcularlo: ${recortar(error.message, 120)}`);
      }
    }
  },
  {
    name: "akinator",
    aliases: ["adivino"],
    category: "juegos",
    desc: "Adivina en lo que piensas con seis preguntas.",
    usage: "[sí|no]",
    run: async ({ reply, chat, msg, text }) => {
      const partida = partidas.get(chat);

      if (!partida || simplificar(text) === "reiniciar") {
        partidas.set(chat, { candidatos: [...FICHAS], preguntadas: [], de: msg.sender });
        const primera = PREGUNTAS[0];
        partidas.get(chat).preguntadas.push(primera.etiqueta);
        return reply(`🔮 *Piensa en algo y te lo adivino*\n\n1) ${primera.texto}\nResponde *.akinator sí* o *.akinator no*`);
      }

      if (partida.de !== msg.sender) return reply("🍅 Esa partida es de otra persona. Abre la tuya con *.akinator reiniciar*");

      const respuesta = respuestaDe(text);
      if (respuesta === null) return reply("🍅 Responde *sí* o *no*.");

      const anterior = partida.preguntadas.at(-1);
      if (respuesta) {
        partida.candidatos = partida.candidatos.filter((f) => f.etiquetas.includes(anterior));
      } else {
        partida.candidatos = partida.candidatos.filter((f) => !f.etiquetas.includes(anterior));
      }

      if (partida.candidatos.length === 1) {
        const ficha = partida.candidatos[0].nombre;
        partidas.delete(chat);
        return reply(`🔮 ¡Listo! Estás pensando en *${ficha}*. ¿Acerté?`);
      }

      if (partida.candidatos.length === 0) {
        partidas.delete(chat);
        return reply("🔮 Me perdí: no me queda ninguna opción. Empecemos otra vez con *.akinator*");
      }

      const siguiente = PREGUNTAS.find((p) => !partida.preguntadas.includes(p.etiqueta));
      if (!siguiente) {
        const opciones = partida.candidatos.map((f) => f.nombre).join(" o ");
        partidas.delete(chat);
        return reply(`🔮 Me quedo entre *${opciones}*. No puedo afinar más.`);
      }

      partida.preguntadas.push(siguiente.etiqueta);
      return reply(
        `🔮 Quedan *${partida.candidatos.length}* opciones.\n\n` +
          `${partida.preguntadas.length}) ${siguiente.texto}`
      );
    }
  },
  {
    name: "plantar",
    aliases: ["sembrar", "huerto"],
    category: "economia",
    desc: "Siembra un tomate y vuelve en 5 minutos a recogerlo.",
    usage: "[cosechar]",
    run: async ({ reply, store, msg, args }) => {
      const usuario = store.usuario(msg.sender);
      usuario.huerto = usuario.huerto || { sembrado: 0, cosechas: 0 };
      const accion = (args[0] || "").toLowerCase();

      if (accion === "cosechar" || accion === "recoger") {
        if (!usuario.huerto.sembrado) return reply("🍅 No tienes nada sembrado. Usa *.plantar*");
        const pasado = Date.now() - usuario.huerto.sembrado;
        if (pasado < 5 * 60_000) {
          const falta = Math.ceil((5 * 60_000 - pasado) / 1000);
          return reply(`🍅 Todavía no madura. Faltan *${falta} s*.`);
        }
        const ganancia = azar(80, 200);
        store.sumarCoins(msg.sender, ganancia);
        usuario.huerto.sembrado = 0;
        usuario.huerto.cosechas += 1;
        store.marcar();
        return reply(`🍅 Cosechaste *${monedas(ganancia)}*. Llevas *${usuario.huerto.cosechas}* cosechas.`);
      }

      if (usuario.huerto.sembrado) {
        const pasado = Date.now() - usuario.huerto.sembrado;
        const falta = Math.max(0, Math.ceil((5 * 60_000 - pasado) / 1000));
        return reply(`🍅 Ya tienes una siembra. Cosecha con *.plantar cosechar* (faltan *${falta} s*).`);
      }

      usuario.huerto.sembrado = Date.now();
      store.marcar();
      return reply("🍅 Sembraste un tomate. Vuelve en 5 minutos y usa *.plantar cosechar*.");
    }
  },
  {
    name: "traducir",
    aliases: ["translate", "tr"],
    category: "juegos",
    desc: "Traduce del español al idioma que pidas (o al revés).",
    usage: "<en|pt|fr|de> <texto>",
    run: async ({ reply, text }) => {
      const trozos = text.split(/\s+/);
      const idiomas = ["en", "pt", "fr", "de", "it", "ja", "ru", "ar"];
      let destino = "en";
      let cuerpo = text;
      if (idiomas.includes((trozos[0] || "").toLowerCase())) {
        destino = trozos[0].toLowerCase();
        cuerpo = trozos.slice(1).join(" ");
      }
      if (!cuerpo.trim()) return reply("🍅 Uso: .traducir en hola mundo");
      try {
        const traducido = await traducirTexto(cuerpo, destino);
        return reply(`🍅 *${destino.toUpperCase()}*\n\n${recortar(traducido, 900)}`);
      } catch (error) {
        return reply(`🍅 No pude traducir: ${recortar(error.message, 140)}`);
      }
    }
  },
  {
    name: "stickerract",
    aliases: ["stickerreaccion"],
    category: "utils",
    desc: "Responde al mensaje citado con la mascota en sticker.",
    run: async ({ reply, send, chat, msg, descargar }) => {
      if (!(await hayFfmpeg())) return reply("🍅 Para hacer stickers hace falta ffmpeg instalado.");
      try {
        let bytes;
        if (msg.quoted?.quotedMessage?.imageMessage) bytes = await descargar("image");
        else bytes = fs.readFileSync(path.join(RAIZ, "assets", "tomate.jpg"));
        const sticker = await aSticker(bytes, { pack: config.nombre, author: config.autor });
        await send(chat, { sticker });
        return true;
      } catch (error) {
        return reply(`🍅 No pude hacer el sticker: ${recortar(error.message, 140)}`);
      }
    }
  },
  {
    name: "stickerreact",
    aliases: ["reaccionsticker"],
    category: "utils",
    desc: "Reacciona al mensaje citado con un emoji de tomate.",
    run: async ({ reply, react, msg }) => {
      if (!msg.quoted?.stanzaId && !msg.quoted?.id) {
        return reply("🍅 Cita el mensaje que quieres reaccionar.");
      }
      const emojis = ["🍅", "🔥", "😂", "👏", "💀", "❤️"];
      await react(elegir(emojis));
      return true;
    }
  },
  {
    name: "spack",
    aliases: ["packstickers"],
    category: "descargas",
    desc: "Convierte la imagen citada en un sticker del bot.",
    run: async ({ reply, send, chat, msg, descargar }) => {
      if (!msg.quoted?.quotedMessage?.imageMessage) return reply("🍅 Cita la imagen que quieres convertir.");
      if (!(await hayFfmpeg())) return reply("🍅 Hace falta ffmpeg para hacer stickers.");
      try {
        const bytes = await descargar("image");
        const sticker = await aSticker(bytes, { pack: config.nombre, author: config.autor });
        await send(chat, { sticker });
        return true;
      } catch (error) {
        return reply(`🍅 No pude convertirla: ${recortar(error.message, 140)}`);
      }
    }
  },
  {
    name: "igsearch",
    aliases: ["buscarig"],
    category: "descargas",
    desc: "Búsqueda en Instagram: el bot no la hace, te da el enlace.",
    usage: "<usuario>",
    run: async ({ reply, text }) => {
      const consulta = text.trim().replace(/^@/, "");
      if (!consulta) return reply("🍅 ¿A quién busco?");
      return reply(
        "🍅 Buscar en Instagram pide sesión iniciada y su API es privada, así que no lo hago desde aquí.\n\n" +
          `Perfil directo: https://www.instagram.com/${encodeURIComponent(consulta)}/`
      );
    }
  },
  {
    name: "tiktoksearch",
    aliases: ["buscartt"],
    category: "descargas",
    desc: "Búsqueda en TikTok: el bot no la hace, te da el enlace.",
    usage: "<tema>",
    run: async ({ reply, text }) => {
      const consulta = text.trim();
      if (!consulta) return reply("🍅 ¿Qué busco en TikTok?");
      return reply(
        "🍅 La búsqueda de TikTok no tiene API pública: te dejo el enlace y para descargar un video usa *.tiktok <enlace>*\n\n" +
          `https://www.tiktok.com/search?q=${encodeURIComponent(consulta)}`
      );
    }
  },
  {
    name: "trivia",
    aliases: ["pregunta"],
    category: "juegos",
    desc: "Pregunta de cultura general con cuatro opciones.",
    run: async ({ reply, store, msg }) => {
      const banco = [
        { p: "¿Cuál es el país más grande del mundo?", o: ["Rusia", "China", "Brasil", "EE. UU."], r: 0 },
        { p: "¿Cuántos lados tiene un hexágono?", o: ["5", "6", "7", "8"], r: 1 },
        { p: "¿Qué planeta es el más cercano al Sol?", o: ["Venus", "Mercurio", "Marte", "Tierra"], r: 1 },
        { p: "¿Quién pintó la Mona Lisa?", o: ["Van Gogh", "Picasso", "Da Vinci", "Miguel Ángel"], r: 2 }
      ];
      const elegida = elegir(banco);
      const letras = ["A", "B", "C", "D"];
      const opciones = elegida.o.map((t, i) => `· ${letras[i]}) ${t}`).join("\n");
      store.chat(msg.chat).trivia = { respuesta: letras[elegida.r], premio: 200 };
      store.marcar();
      return reply(`🍅 *Trivia*\n\n${elegida.p}\n\n${opciones}\n\nResponde con *.responder A*`);
    }
  },
  {
    name: "responder",
    aliases: ["respuesta"],
    category: "juegos",
    desc: "Responde la trivia abierta.",
    usage: "<A|B|C|D>",
    run: async ({ reply, store, msg, args }) => {
      const abierta = store.chat(msg.chat).trivia;
      if (!abierta) return reply("🍅 No hay trivia abierta. Abre una con *.trivia*");
      const dicha = (args[0] || "").toUpperCase();
      store.chat(msg.chat).trivia = null;
      store.marcar();
      if (dicha === abierta.respuesta) {
        store.sumarCoins(msg.sender, abierta.premio || 200);
        return reply(`🍅 ¡Correcto! +${monedas(abierta.premio || 200)}`);
      }
      return reply(`🍅 Era la *${abierta.respuesta}*. Otra vez será.`);
    }
  }
];
