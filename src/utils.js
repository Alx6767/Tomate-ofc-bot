/**
 * Tomate ofc bot — utilidades compartidas.
 *
 * Solo funciones puras o casi: nada aquí guarda estado del bot ni habla con
 * WhatsApp. Lo que necesita red pide `fetch` y devuelve datos, no mensajes.
 */

import { config } from "./config.js";

/** Entero al azar entre `min` y `max`, los dos incluidos. */
export const azar = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/** Un elemento al azar de una lista. */
export const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];

/** Baraja una copia de la lista (Fisher-Yates). */
export function barajar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** Promesa que se resuelve pasados `ms` milisegundos. */
export const esperar = (ms) => new Promise((listo) => setTimeout(listo, ms));

/** Número con separadores de miles: 1234567 → "1,234,567". */
export const numero = (valor) => Number(valor || 0).toLocaleString("es-MX");

/** Moneda del bot. */
export const monedas = (valor) => `${numero(valor)} 🍅`;

/** "3d 4h 12m" a partir de una diferencia en milisegundos. */
export function duracion(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const dias = Math.floor(total / 86400);
  const horas = Math.floor((total % 86400) / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;
  const partes = [];
  if (dias) partes.push(`${dias}d`);
  if (horas) partes.push(`${horas}h`);
  if (minutos) partes.push(`${minutos}m`);
  if (!dias && !horas) partes.push(`${segundos}s`);
  return partes.join(" ");
}

/** Fecha legible en la zona configurada. */
export const fecha = (valor = Date.now(), opciones = {}) =>
  new Date(valor).toLocaleString("es-MX", { timeZone: config.zona, ...opciones });

/** Hora actual "HH:MM:SS". */
export const hora = (valor = Date.now()) =>
  new Date(valor).toLocaleTimeString("es-MX", { timeZone: config.zona, hour12: false });

/** Solo los dígitos de un JID o de un número escrito a mano. */
export const soloDigitos = (texto) => String(texto || "").replace(/\D/g, "");

/**
 * JID a partir de lo que escribió el usuario: número suelto, mención o JID
 * completo. Devuelve `null` si no hay dígitos.
 */
export function aJid(entrada) {
  const crudo = String(entrada || "").trim();
  if (!crudo) return null;
  if (crudo.includes("@")) return crudo;
  const digitos = soloDigitos(crudo);
  if (!digitos) return null;
  return `${digitos}@s.whatsapp.net`;
}

/** Nombre corto de un JID, para listas y menciones. */
export const nombreCorto = (jid) => String(jid || "").split("@")[0].split(":")[0];

/**
 * Ajusta un número escrito a medias al formato que espera WhatsApp.
 *
 * No inventa país si el número ya parece completo: solo antepone el código
 * configurado cuando el número tiene 10 dígitos (formato local habitual en
 * México y buena parte de Latinoamérica).
 */
export function normalizarTelefono(entrada) {
  const digitos = soloDigitos(entrada);
  if (!digitos) return "";
  if (digitos.length > 11) return digitos;
  if (digitos.length === 10) {
    const prefijo = { MX: "52", CO: "57", PE: "51", AR: "54", CL: "56", ES: "34", US: "1" }[config.pais];
    if (prefijo) return prefijo + digitos;
  }
  return digitos;
}

/** Descarga un JSON con límite de tiempo. Lanza con motivo claro. */
export async function pedirJson(url, { tiempo = 12000, cabeceras = {} } = {}) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), tiempo);
  try {
    const respuesta = await fetch(url, {
      headers: { "user-agent": "TomateOfcBot/1.0", ...cabeceras },
      signal: control.signal
    });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    return await respuesta.json();
  } finally {
    clearTimeout(reloj);
  }
}

/** Descarga bytes con límite de tiempo y tope de tamaño. */
export async function pedirBytes(url, { tiempo = 30000, maximo = 64 * 1024 * 1024, cabeceras = {} } = {}) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), tiempo);
  try {
    const respuesta = await fetch(url, {
      headers: { "user-agent": "TomateOfcBot/1.0", ...cabeceras },
      signal: control.signal
    });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    const largo = Number(respuesta.headers.get("content-length") || 0);
    if (largo && largo > maximo) throw new Error(`el archivo pesa ${Math.round(largo / 1048576)} MB, demasiado`);
    const bytes = Buffer.from(await respuesta.arrayBuffer());
    if (bytes.length > maximo) throw new Error("el archivo es demasiado grande");
    return bytes;
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * Separa el primer argumento del resto.
 * `"ana 500"` → `{ primero: "ana", resto: "500" }`
 */
export function partir(texto) {
  const limpio = String(texto || "").trim();
  if (!limpio) return { primero: "", resto: "" };
  const espacio = limpio.search(/\s/);
  if (espacio === -1) return { primero: limpio, resto: "" };
  return { primero: limpio.slice(0, espacio), resto: limpio.slice(espacio + 1).trim() };
}

/**
 * Convierte "10k", "2m", "1500" o "todo" en un número.
 * Devuelve `null` si no se entiende, para que el comando lo diga.
 */
export function aCantidad(texto, disponible = Infinity) {
  const limpio = String(texto || "").trim().toLowerCase();
  if (!limpio) return null;
  if (["todo", "all", "max"].includes(limpio)) {
    return Number.isFinite(disponible) ? Math.floor(disponible) : null;
  }
  const coincidencia = limpio.match(/^(\d+(?:[.,]\d+)?)\s*(k|m|mil|millon|millón)?$/);
  if (!coincidencia) return null;
  const base = Number(coincidencia[1].replace(",", "."));
  if (!Number.isFinite(base)) return null;
  const escala = { k: 1000, mil: 1000, m: 1e6, millon: 1e6, "millón": 1e6 }[coincidencia[2]] || 1;
  const total = Math.floor(base * escala);
  return total >= 0 ? total : null;
}

/** Barra de progreso en texto: `▰▰▰▱▱▱ 50%`. */
export function barra(valor, total, ancho = 10) {
  const parte = total > 0 ? Math.min(1, Math.max(0, valor / total)) : 0;
  const llenas = Math.round(parte * ancho);
  return `${"▰".repeat(llenas)}${"▱".repeat(ancho - llenas)} ${Math.round(parte * 100)}%`;
}

/** Recorta un texto sin cortar palabras a la mitad. */
export function recortar(texto, maximo = 120) {
  const limpio = String(texto || "").trim();
  if (limpio.length <= maximo) return limpio;
  const corte = limpio.slice(0, maximo);
  const ultimoEspacio = corte.lastIndexOf(" ");
  return `${(ultimoEspacio > maximo * 0.6 ? corte.slice(0, ultimoEspacio) : corte).trim()}…`;
}

/** Quita acentos y signos: sirve para comparar respuestas de juegos. */
export const simplificar = (texto) =>
  String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
