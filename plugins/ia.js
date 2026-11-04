/**
 * Tomate ofc bot — inteligencia artificial.
 *
 * Cada comando usa un proveedor concreto y avisa si falta la clave. El hilo
 * de conversación se guarda por chat: `reset` lo borra.
 */

import { config } from "../src/config.js";
import { hayIa, olvidar, preguntar, proveedorPorDefecto, recordar, SIN_CLAVE } from "../src/ia.js";
import { recortar } from "../src/utils.js";

const SISTEMA = `Eres el asistente de ${config.nombre}, un bot de WhatsApp.
Contesta en español, breve (máximo 6 líneas), con tono cercano y sin inventar datos.
Si no sabes algo, dilo.`;

/** Cuerpo común de los comandos de IA. */
async function responder({ reply, chat, text, proveedor }) {
  if (!text) return reply("🍅 Escribe tu pregunta después del comando.");
  try {
    const respuesta = await preguntar(proveedor, text, { chat, sistema: SISTEMA });
    recordar(chat, "user", text);
    recordar(chat, "assistant", respuesta);
    return reply(recortar(respuesta, 3000));
  } catch (error) {
    return reply(recortar(error.message, 300));
  }
}

export default [
  {
    name: "gemini",
    aliases: ["ia", "bot"],
    category: "ia",
    desc: "Pregúntale a Gemini.",
    usage: "<pregunta>",
    run: async (ctx) => {
      if (!config.ia.gemini) return ctx.reply(SIN_CLAVE.gemini);
      return responder({ ...ctx, proveedor: "gemini" });
    }
  },
  {
    name: "chatgpt",
    aliases: ["gpt", "openai"],
    category: "ia",
    desc: "Pregúntale a GPT.",
    usage: "<pregunta>",
    run: async (ctx) => {
      if (!config.ia.openai) return ctx.reply(SIN_CLAVE.openai);
      return responder({ ...ctx, proveedor: "openai" });
    }
  },
  {
    name: "iasaurio",
    aliases: ["groq"],
    category: "ia",
    desc: "Pregunta al modelo rápido de Groq.",
    usage: "<pregunta>",
    run: async (ctx) => {
      if (!config.ia.groq) return ctx.reply(SIN_CLAVE.groq);
      return responder({ ...ctx, proveedor: "groq" });
    }
  },
  {
    name: "simi",
    aliases: ["hablar"],
    category: "ia",
    desc: "Charla con el proveedor que esté configurado.",
    usage: "<texto>",
    run: async (ctx) => {
      const proveedor = proveedorPorDefecto();
      if (!proveedor) return ctx.reply(`🍅 No hay ninguna IA configurada.\n\n${SIN_CLAVE.gemini}`);
      return responder({ ...ctx, proveedor });
    }
  },
  {
    name: "reset",
    aliases: ["olvidar"],
    category: "ia",
    desc: "Borra el hilo de conversación con la IA.",
    run: async ({ reply, chat }) => {
      olvidar(chat);
      return reply("🍅 Listo, olvidé la conversación de este chat.");
    }
  }
];
