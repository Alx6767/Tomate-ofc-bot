/**
 * Tomate ofc bot — proveedores de IA.
 *
 * Tres proveedores, todos con clave propia y todos opcionales. Sin clave, el
 * comando responde que falta configurarla y dice dónde ponerla. No hay trucos
 * para colarse en servicios ajenos: si no hay clave, no hay respuesta.
 *
 * La conversación se guarda por chat en memoria (las últimas 8 vueltas), así
 * el bot recuerda el hilo sin llenar el disco.
 */

import { config } from "./config.js";

/** Historial por chat: jid → [{ rol, texto }] */
const historial = new Map();
const MAX_VUELTAS = 8;

/** Texto de error común cuando falta la clave. */
export const SIN_CLAVE = {
  gemini: "🍅 Falta `GEMINI_KEY` en el archivo `.env`. Se saca gratis en https://aistudio.google.com/apikey",
  openai: "🍅 Falta `OPENAI_KEY` en el archivo `.env`.",
  groq: "🍅 Falta `GROQ_KEY` en el archivo `.env`. Es gratis en https://console.groq.com/keys"
};

/** ¿Hay alguna IA configurada? */
export const hayIa = () => Boolean(config.ia.gemini || config.ia.openai || config.ia.groq);

/** Proveedor disponible por orden de preferencia. */
export function proveedorPorDefecto() {
  if (config.ia.gemini) return "gemini";
  if (config.ia.groq) return "groq";
  if (config.ia.openai) return "openai";
  return null;
}

/** Historial de un chat (se crea si no existe). */
export function historialDe(chat) {
  if (!historial.has(chat)) historial.set(chat, []);
  return historial.get(chat);
}

/** Borra el hilo de un chat. */
export const olvidar = (chat) => historial.delete(chat);

/** Recorta el historial a las últimas vueltas. */
export function recordar(chat, rol, texto) {
  const hilo = historialDe(chat);
  hilo.push({ rol, texto });
  while (hilo.length > MAX_VUELTAS * 2) hilo.shift();
}

/** Pide una respuesta al proveedor indicado. */
export async function preguntar(proveedor, prompt, { chat = "", sistema = "" } = {}) {
  const hilo = chat ? historialDe(chat) : [];

  if (proveedor === "gemini") {
    if (!config.ia.gemini) throw new Error(SIN_CLAVE.gemini);
    const cuerpo = {
      contents: [
        ...(sistema ? [{ role: "user", parts: [{ text: sistema }] }, { role: "model", parts: [{ text: "Entendido." }] }] : []),
        ...hilo.map((v) => ({ role: v.rol === "user" ? "user" : "model", parts: [{ text: v.texto }] })),
        { role: "user", parts: [{ text: prompt }] }
      ],
      generationConfig: { temperature: 0.8, maxOutputTokens: 800 }
    };
    const respuesta = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.ia.gemini}`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) }
    );
    if (!respuesta.ok) throw new Error(`Gemini respondió ${respuesta.status}`);
    const datos = await respuesta.json();
    const texto = datos?.candidates?.[0]?.content?.parts?.map((p) => p.text).join(" ") || "";
    if (!texto) throw new Error("Gemini no devolvió texto");
    return texto.trim();
  }

  const compatible = proveedor === "groq"
    ? { url: "https://api.groq.com/openai/v1/chat/completions", clave: config.ia.groq, modelo: "llama-3.1-8b-instant" }
    : { url: "https://api.openai.com/v1/chat/completions", clave: config.ia.openai, modelo: "gpt-4o-mini" };

  if (!compatible.clave) throw new Error(SIN_CLAVE[proveedor] || SIN_CLAVE.openai);

  const mensajes = [
    ...(sistema ? [{ role: "system", content: sistema }] : []),
    ...hilo.map((v) => ({ role: v.rol === "user" ? "user" : "assistant", content: v.texto })),
    { role: "user", content: prompt }
  ];

  const respuesta = await fetch(compatible.url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${compatible.clave}` },
    body: JSON.stringify({ model: compatible.modelo, messages: mensajes, temperature: 0.8, max_tokens: 800 })
  });
  if (!respuesta.ok) throw new Error(`${proveedor} respondió ${respuesta.status}`);
  const datos = await respuesta.json();
  const texto = datos?.choices?.[0]?.message?.content || "";
  if (!texto) throw new Error(`${proveedor} no devolvió texto`);
  return texto.trim();
}

export default preguntar;
