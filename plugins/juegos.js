/**
 * Tomate ofc bot — juegos y diversión.
 *
 * Los juegos con partida guardan su estado en memoria por chat: si el bot se
 * reinicia la partida se pierde, y eso se dice cuando pasa. No hay estado
 * compartido entre chats, así que dos grupos pueden jugar a la vez.
 */

import {
  CHISTES,
  FRASES,
  HOROSCOPOS,
  PIROPOS,
  RESPUESTAS_8BALL,
  RETOS,
  SIGNOS,
  VERDADES
} from "../src/extra.js";
import { azar, elegir, nombreCorto, pedirJson, recortar, simplificar } from "../src/utils.js";

/** Partidas activas de ahorcado: chat → estado. */
const ahorcados = new Map();

/** Preguntas aprendidas por chat. */
const aprendido = new Map();

const PALABRAS = [
  "tomate", "ensalada", "cosecha", "huerto", "salsa", "jitomate", "semilla",
  "invernadero", "tractor", "regadera", "composta", "germinar", "rama", "fruto"
];

/** Dibuja el muñeco según los fallos. */
const DIBUJO = [
  "  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========",
  "  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========",
  "  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========",
  "  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========",
  "  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========",
  "  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========",
  "  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n========="
];

/** Texto con las letras acertadas y guiones por las que faltan. */
const pista = (estado) =>
  [...estado.palabra].map((letra) => (estado.acertadas.has(letra) ? letra : "_")).join(" ");

/** Porcentaje estable para dos identificadores (mismo par, mismo número). */
function porcentajeEntre(a, b) {
  const orden = [String(a), String(b)].sort().join("|");
  let suma = 0;
  for (const caracter of orden) suma = (suma * 31 + caracter.codePointAt(0)) % 100000;
  return (suma % 71) + 15;
}

/** Alguien del chat: el citado, el mencionado o quien escribe. */
function objetivo(msg) {
  return msg.quoted?.participant || msg.mentionedJid?.[0] || msg.sender;
}

export default [
  {
    name: "8ball",
    aliases: ["bola", "destino"],
    category: "juegos",
    desc: "Pregúntale algo a la bola de tomate.",
    usage: "<pregunta>",
    run: async ({ reply, text }) => {
      if (!text) return reply("🍅 Hazme una pregunta y te contesto.");
      return reply(`🍅 *Pregunta:* ${recortar(text, 200)}\n*Respuesta:* ${elegir(RESPUESTAS_8BALL)}`);
    }
  },
  {
    name: "dado",
    category: "juegos",
    desc: "Tira un dado de seis caras.",
    run: async ({ reply }) => {
      const caras = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
      const tirada = azar(1, 6);
      return reply(`🍅 Sacaste ${caras[tirada - 1]} *${tirada}*`);
    }
  },
  {
    name: "dados",
    category: "juegos",
    desc: "Tira dos dados y suma.",
    run: async ({ reply }) => {
      const a = azar(1, 6);
      const b = azar(1, 6);
      return reply(`🍅 Dados: *${a}* y *${b}* → total *${a + b}*`);
    }
  },
  {
    name: "moneda",
    aliases: ["coinflip"],
    category: "juegos",
    desc: "Lanza una moneda al aire.",
    run: async ({ reply }) => reply(`🍅 Salió *${elegir(["cara", "cruz"])}*.`)
  },
  {
    name: "azar",
    category: "juegos",
    desc: "Número al azar entre dos valores.",
    usage: "<mínimo> <máximo>",
    run: async ({ reply, args }) => {
      const min = Number(args[0] ?? 1);
      const max = Number(args[1] ?? 100);
      if (!Number.isFinite(min) || !Number.isFinite(max)) return reply("🍅 Uso: .azar 1 100");
      const bajo = Math.min(min, max);
      const alto = Math.max(min, max);
      return reply(`🍅 Entre *${bajo}* y *${alto}* salió *${azar(bajo, alto)}*`);
    }
  },
  {
    name: "ppt",
    aliases: ["piedrapapel"],
    category: "juegos",
    desc: "Piedra, papel o tijera contra el bot.",
    usage: "<piedra|papel|tijera>",
    run: async ({ reply, text }) => {
      const opciones = ["piedra", "papel", "tijera"];
      const eleccion = simplificar(text);
      if (!opciones.includes(eleccion)) return reply("🍅 Elige: piedra, papel o tijera.");
      const rival = elegir(opciones);
      const gana = { piedra: "tijera", papel: "piedra", tijera: "papel" };
      const resultado =
        eleccion === rival ? "Empate." : gana[eleccion] === rival ? "Ganas tú. 🍅" : "Gano yo. 🍅";
      return reply(`🍅 Tú: *${eleccion}* · Yo: *${rival}*\n${resultado}`);
    }
  },
  {
    name: "ruletarusa",
    aliases: ["tambor"],
    category: "juegos",
    desc: "Ruleta rusa con tambor de seis recámaras.",
    run: async ({ reply, msg }) => {
      const bala = azar(1, 6);
      const disparo = azar(1, 6);
      if (bala === disparo) {
        return reply(`🍅 💥 *¡Pum!* ${msg.pushName || msg.numero} no corrió con suerte.`);
      }
      return reply(`🍅 Clic. Tambor ${disparo}/6. Sigues vivo.`);
    }
  },
  {
    name: "verdad",
    category: "juegos",
    desc: "Pregunta de verdad para el grupo.",
    run: async ({ reply, msg }) => {
      return reply(`🍅 *Verdad para ${msg.pushName || msg.numero}:*\n${elegir(VERDADES)}`);
    }
  },
  {
    name: "reto",
    category: "juegos",
    desc: "Reto para el grupo.",
    run: async ({ reply, msg }) => {
      return reply(`🍅 *Reto para ${msg.pushName || msg.numero}:*\n${elegir(RETOS)}`);
    }
  },
  {
    name: "chiste",
    aliases: ["broma"],
    category: "juegos",
    desc: "Un chiste malo, garantizado.",
    run: async ({ reply }) => reply(`🍅 ${elegir(CHISTES)}`)
  },
  {
    name: "frase",
    category: "juegos",
    desc: "Una frase para el día.",
    run: async ({ reply }) => reply(`🍅 ${elegir(FRASES)}`)
  },
  {
    name: "piropo",
    category: "juegos",
    desc: "Un piropo de cosecha propia.",
    run: async ({ reply, msg }) => {
      const quien = msg.quoted?.participant ? nombreCorto(msg.quoted.participant) : "para ti";
      return reply(`🍅 *${quien}*: ${elegir(PIROPOS)}`);
    }
  },
  {
    name: "horoscopo",
    aliases: ["signo"],
    category: "juegos",
    desc: "Horóscopo del día para tu signo.",
    usage: "<signo>",
    run: async ({ reply, text }) => {
      const signo = simplificar(text);
      if (!SIGNOS.includes(signo)) return reply(`🍅 Signos: ${SIGNOS.join(", ")}`);
      const hoy = new Date().toISOString().slice(0, 10);
      const indice = [...(signo + hoy)].reduce((suma, c) => suma + c.codePointAt(0), 0) % HOROSCOPOS.length;
      return reply(`🍅 *${signo.toUpperCase()}*\n${HOROSCOPOS[indice]}`);
    }
  },
  {
    name: "ship",
    aliases: ["amor"],
    category: "juegos",
    desc: "Calcula el amor entre dos personas.",
    usage: "<@persona> o cita un mensaje",
    run: async ({ reply, msg }) => {
      const otro = objetivo(msg);
      if (otro === msg.sender) return reply("🍅 Necesito otra persona: cita su mensaje o menciónala.");
      const amor = porcentajeEntre(msg.sender, otro);
      const barra = "▰".repeat(Math.round(amor / 10)) + "▱".repeat(10 - Math.round(amor / 10));
      return reply(
        `🍅 *${nombreCorto(msg.sender)}* + *${nombreCorto(otro)}*\n${barra} ${amor}%`
      );
    }
  },
  {
    name: "parejas",
    category: "juegos",
    desc: "Empareja a dos personas del grupo al azar.",
    group: true,
    run: async ({ reply, participants }) => {
      const gente = participants.map((p) => nombreCorto(p.id)).filter(Boolean);
      if (gente.length < 2) return reply("🍅 Hace falta más gente en el grupo.");
      const [a, b] = [elegir(gente), elegir(gente)];
      if (a === b) return reply("🍅 Salieron los mismos dos. Otra vez.");
      return reply(`🍅 Pareja del día: *${a}* 💞 *${b}*`);
    }
  },
  {
    name: "topgays",
    category: "juegos",
    desc: "Ranking totalmente inventado del grupo.",
    group: true,
    run: async ({ reply, participants }) => {
      const lista = participants
        .map((p) => ({ quien: nombreCorto(p.id), puntos: azar(1, 100) }))
        .sort((a, b) => b.puntos - a.puntos)
        .slice(0, 5);
      const texto = lista.map((f, i) => `${i + 1}. ${f.quien} — ${f.puntos}%`).join("\n");
      return reply(`🍅 *Ranking (sin fundamento)*\n\n${texto}`);
    }
  },
  {
    name: "gay",
    category: "juegos",
    desc: "Porcentaje inventado, solo por diversión.",
    run: async ({ reply, msg }) => {
      const quien = objetivo(msg);
      return reply(`🍅 *${nombreCorto(quien)}*: ${porcentajeEntre(quien, "gay")}%`);
    }
  },
  {
    name: "lesbiana",
    category: "juegos",
    desc: "Porcentaje inventado, solo por diversión.",
    run: async ({ reply, msg }) => {
      const quien = objetivo(msg);
      return reply(`🍅 *${nombreCorto(quien)}*: ${porcentajeEntre(quien, "lesbiana")}%`);
    }
  },
  {
    name: "otaku",
    category: "juegos",
    desc: "Nivel de otakismo, medido con rigor cero.",
    run: async ({ reply, msg }) => {
      const quien = objetivo(msg);
      const nivel = porcentajeEntre(quien, "otaku");
      const titulo = nivel > 80 ? "Otaku legendario" : nivel > 50 ? "Otaku de fin de semana" : "Apenas un aprendiz";
      return reply(`🍅 *${nombreCorto(quien)}*\n${nivel}% — ${titulo}`);
    }
  },
  {
    name: "juicio",
    category: "juegos",
    desc: "El tribunal del tomate decide quién es culpable.",
    group: true,
    run: async ({ reply, msg, participants }) => {
      const acusado = objetivo(msg);
      const veredicto = elegir(["culpable", "inocente", "culpable", "inocente", "culpable con atenuantes"]);
      const condena = veredicto.startsWith("culpable")
        ? ` Condena: ${elegir(["10 chistes", "un audio cantando", "5 stickers", "contar su día en 3 palabras"])}.`
        : "";
      const juez = elegir(participants.map((p) => nombreCorto(p.id)));
      return reply(
        `🍅 *Tribunal del tomate*\n\n· Acusado: *${nombreCorto(acusado)}*\n· Juez: *${juez}*\n· Veredicto: *${veredicto}*.${condena}`
      );
    }
  },
  {
    name: "culpable",
    category: "juegos",
    desc: "Declara culpable a alguien, sin pruebas.",
    run: async ({ reply, msg }) => reply(`🍅 *${nombreCorto(objetivo(msg))}* es culpable. Sin pruebas, pero culpable.`)
  },
  {
    name: "inocente",
    category: "juegos",
    desc: "Declara inocente a alguien, sin pruebas.",
    run: async ({ reply, msg }) => reply(`🍅 *${nombreCorto(objetivo(msg))}* es inocente. Que quede en el acta.`)
  },
  {
    name: "doxeo",
    category: "juegos",
    desc: "Ficha ficticia de alguien. No muestra datos reales.",
    run: async ({ reply, msg }) => {
      // Este comando es un chiste y se queda en chiste: no busca, no consulta y
      // no revela nada real. Todo lo que imprime está inventado aquí mismo.
      const quien = nombreCorto(objetivo(msg));
      return reply(
        `🍅 *Ficha (100% inventada, no se guarda nada real)*\n\n` +
          `· Nombre: *${quien}*\n` +
          `· Ciudad: *${elegir(["Tomatelandia", "Villa Salsa", "Nueva Ensalada"])}*\n` +
          `· Profesión: *${elegir(["catador de jitomates", "riego profesional", "inspector de semillas"])}*\n` +
          `· Secreto: *${elegir(["le gusta la pizza sin tomate", "habla con las plantas", "no le gusta el kétchup"])}*`
      );
    }
  },
  {
    name: "ahorcado",
    category: "juegos",
    desc: "Ahorcado por chat. Sin argumento empieza, con letra adivina.",
    usage: "[letra]",
    run: async ({ reply, chat, args }) => {
      const letra = (args[0] || "").toLowerCase();
      const estado = ahorcados.get(chat);

      if (!estado || letra === "nuevo" || letra === "reiniciar") {
        const palabra = elegir(PALABRAS);
        const nuevo = { palabra, acertadas: new Set(), fallos: 0 };
        ahorcados.set(chat, nuevo);
        return reply(`🍅 *¡Ahorcado!*\n\n\`\`\`${DIBUJO[0]}\`\`\`\n\n${pista(nuevo)}\n\nEscribe *.ahorcado <letra>*`);
      }

      if (!/^[a-zñ]$/.test(letra)) return reply("🍅 Manda una sola letra, o `.ahorcado nuevo` para reiniciar.");

      if (estado.palabra.includes(letra)) estado.acertadas.add(letra);
      else estado.fallos += 1;

      const gano = [...estado.palabra].every((l) => estado.acertadas.has(l));
      if (gano) {
        ahorcados.delete(chat);
        return reply(`🍅 ¡Ganaste! La palabra era *${estado.palabra}*.`);
      }
      if (estado.fallos >= 6) {
        ahorcados.delete(chat);
        return reply(`🍅 *Ahorcado.*\n\n\`\`\`${DIBUJO[6]}\`\`\`\n\nLa palabra era *${estado.palabra}*.`);
      }
      return reply(
        `\`\`\`${DIBUJO[estado.fallos]}\`\`\`\n\n${pista(estado)}\n\n` +
          `Fallos: *${estado.fallos}/6* · Letras usadas: ${[...estado.acertadas].join(", ") || "ninguna"}`
      );
    }
  },
  {
    name: "aprender",
    aliases: ["enseñar"],
    category: "juegos",
    desc: "Enseña una respuesta al bot para este chat.",
    usage: "<pregunta> = <respuesta>",
    run: async ({ reply, chat, text }) => {
      const [pregunta, respuesta] = text.split("=").map((p) => p.trim());
      if (!pregunta || !respuesta) {
        return reply("🍅 Uso: .aprender ¿quién eres? = un tomate con botones");
      }
      const memoria = aprendido.get(chat) || new Map();
      memoria.set(simplificar(pregunta), respuesta);
      aprendido.set(chat, memoria);
      return reply(`🍅 Aprendido. Ahora si alguien escribe *${pregunta}* contesto.`);
    }
  },
  {
    name: "anonimo",
    aliases: ["anon"],
    category: "juegos",
    desc: "Publica un mensaje anónimo en el grupo.",
    usage: "<texto>",
    group: true,
    run: async ({ reply, chat, text, send, msg }) => {
      if (!text) return reply("🍅 Escribe el mensaje anónimo después del comando.");
      await send(chat, { text: `🍅 *Anónimo:*\n${recortar(text, 800)}` });
      // Se borra el original si el bot puede; si no, queda el aviso.
      await send(chat, { delete: msg.key }).catch(() => {});
      return true;
    }
  },
  {
    name: "meme",
    category: "juegos",
    desc: "Trae un meme aleatorio.",
    run: async ({ reply, send, chat }) => {
      try {
        const datos = await pedirJson("https://meme-api.com/gimme");
        if (!datos?.url) throw new Error("el servicio no devolvió imagen");
        await send(chat, { image: { url: datos.url }, caption: `🍅 ${datos.title || "meme"}` });
        return true;
      } catch (error) {
        return reply(`🍅 No pude traer el meme: ${recortar(error.message, 120)}`);
      }
    }
  },
  {
    name: "sorteo",
    category: "juegos",
    desc: "Elige a una persona al azar de las que reaccionaron o del grupo.",
    group: true,
    run: async ({ reply, participants }) => {
      const gente = participants.map((p) => nombreCorto(p.id)).filter(Boolean);
      if (!gente.length) return reply("🍅 No hay a quién sortear.");
      return reply(`🍅 *Ganador del sorteo:* ${elegir(gente)} 🍅`);
    }
  },
  {
    name: "pedir",
    category: "juegos",
    desc: "Pide un deseo al tomate.",
    usage: "<deseo>",
    run: async ({ reply, text }) => {
      if (!text) return reply("🍅 Pide algo y veremos qué dice el tomate.");
      const concedido = azar(0, 100) > 45;
      return reply(
        `🍅 *Deseo:* ${recortar(text, 200)}\n` +
          (concedido ? "El tomate dice que *sí*, pero pon de tu parte. 🍅" : "El tomate dice que *hoy no*. Mañana vuelve a pedir.")
      );
    }
  },
  {
    name: "afk",
    category: "juegos",
    desc: "Marca que estás ausente; el bot lo avisa si te mencionan.",
    usage: "<motivo>",
    run: async ({ reply, store, msg, text }) => {
      const estado = store.usuario(msg.sender);
      estado.afk = { desde: Date.now(), motivo: text || "sin motivo" };
      store.marcar();
      return reply(`🍅 *${msg.pushName || msg.numero}* queda ausente: ${text || "sin motivo"}.`);
    }
  },
  {
    name: "cumpleaños",
    aliases: ["cumple"],
    category: "juegos",
    desc: "Guarda tu cumpleaños y consulta los del grupo.",
    usage: "<dd/mm>",
    group: true,
    run: async ({ reply, store, chat, text, msg }) => {
      if (text) {
        if (!/^\d{1,2}\/\d{1,2}$/.test(text.trim())) return reply("🍅 Formato: .cumpleaños 14/03");
        store.chat(chat).cumples = { ...(store.chat(chat).cumples || {}), [msg.sender]: text.trim() };
        store.marcar();
        return reply(`🍅 Guardado: *${text.trim()}*.`);
      }
      const cumples = store.chat(chat).cumples || {};
      const lista = Object.entries(cumples).map(([quien, cuando]) => `· ${nombreCorto(quien)} — ${cuando}`);
      return reply(lista.length ? `🍅 *Cumpleaños del grupo*\n\n${lista.join("\n")}` : "🍅 Nadie ha guardado su cumpleaños todavía.");
    }
  }
];
