/**
 * Tomate ofc bot — fuentes de descarga para YouTube.
 *
 * Por qué no se usa solo yt-dlp: yt-dlp funciona en un teléfono (IP de casa)
 * pero en un servidor, VPS o hosting gratuito YouTube lo bloquea con
 * «Sign in to confirm you're not a bot». Comprobado: con yt-dlp instalado y
 * actualizado, desde una IP de datacenter la descarga falla siempre.
 *
 * Así que aquí hay tres caminos, y se prueban en orden hasta que uno entregue
 * el archivo de verdad (no basta con que devuelva un enlace: se descarga y se
 * comprueba que pese y que sea audio o vídeo):
 *
 *   1. @vreden/youtube_scraper  → entrega un enlace directo al mp3/mp4
 *   2. btch-downloader          → otro servicio, sirve de respaldo
 *   3. yt-dlp                   → el de siempre, si está instalado y hay IP buena
 *
 * Las dependencias 1 y 2 son opcionales: si no están instaladas, se saltan y
 * el archivo se sigue intentando con la siguiente. Nunca se miente: si ninguna
 * funciona, el error dice qué pasó con cada una.
 */

import { hayYtdlp, descargar as descargarConYtdlp, info as infoConYtdlp } from "./ytdlp.js";
import { pedirJson } from "./utils.js";

/** Tope de tamaño por archivo (MB). */
export const TOPE_MB = 60;

/** Tiempo máximo por intento (ms). */
const TIEMPO = 90_000;

/** Caché de módulos ya cargados (o marcados como ausentes). */
const modulos = new Map();

/**
 * Carga un paquete opcional.
 * @returns {Promise<any|null>} el módulo, o null si no está instalado
 */
async function opcional(nombre) {
  if (modulos.has(nombre)) return modulos.get(nombre);
  let cargado = null;
  try {
    cargado = await import(nombre);
  } catch {
    cargado = null;
  }
  modulos.set(nombre, cargado);
  return cargado;
}

/** El paquete de búsqueda de YouTube, si está. */
async function busqueda() {
  const mod = await opcional("yt-search");
  if (!mod) return null;
  return mod.default || mod;
}

/**
 * Busca un vídeo por texto o comprueba un enlace.
 *
 * @param {string} consulta texto libre o URL de YouTube
 * @returns {Promise<object|null>} datos del vídeo
 */
export async function buscar(consulta) {
  const yts = await busqueda();
  if (!yts) throw new Error("falta el paquete *yt-search* (npm install)");

  const enlace = String(consulta || "").match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/\S+/)?.[0];
  if (enlace) {
    const id = enlace.split("v=")[1]?.split("&")[0] || enlace.split("/").pop();
    const porId = await yts({ videoId: id }).catch(() => null);
    const video = porId?.videos?.[0];
    if (video) return normalizar(video);
  }

  const texto = String(consulta || "").replace(/https?:\/\/\S+/g, "").trim();
  if (!texto) return null;
  const resultados = await yts(texto);
  const video = resultados?.videos?.[0];
  return video ? normalizar(video) : null;
}

/** Deja los datos del vídeo en un formato fijo. */
function normalizar(video) {
  return {
    titulo: video.title || "sin título",
    url: video.url,
    id: video.videoId || "",
    autor: video.author?.name || "",
    duracion: Number(video.seconds) || 0,
    segundos: Number(video.seconds) || 0,
    vistas: Number(video.views) || 0,
    miniatura: video.thumbnail || "",
    descripcion: video.description || ""
  };
}

/** Descarga un archivo con tope de tamaño y de tiempo. */
async function traerBytes(url, { senal } = {}) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIEMPO);
  if (senal) senal.addEventListener("abort", () => control.abort(), { once: true });
  try {
    const respuesta = await fetch(url, {
      redirect: "follow",
      signal: control.signal,
      headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64)" }
    });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

    const tipo = respuesta.headers.get("content-type") || "";
    const declarado = Number(respuesta.headers.get("content-length") || 0);
    if (declarado > TOPE_MB * 1024 * 1024) {
      throw new Error(`pesa ${(declarado / 1024 / 1024).toFixed(0)} MB y el tope es ${TOPE_MB} MB`);
    }

    const bytes = Buffer.from(await respuesta.arrayBuffer());
    if (bytes.length < 8 * 1024) throw new Error("el archivo llegó vacío o cortado");
    if (bytes.length > TOPE_MB * 1024 * 1024) throw new Error(`pasó el tope de ${TOPE_MB} MB`);
    return { bytes, tipo };
  } finally {
    clearTimeout(reloj);
  }
}

/** Proveedores que devuelven una URL de audio o vídeo. */
const PROVEEDORES = [
  {
    nombre: "vreden",
    async url(video, audio) {
      const mod = await opcional("@vreden/youtube_scraper");
      if (!mod) return null;
      const fn = audio ? mod.ytmp3 : mod.ytmp4;
      if (typeof fn !== "function") return null;
      const datos = await fn(video.url);
      return datos?.status ? datos?.download?.url || null : null;
    }
  },
  {
    nombre: "btch",
    async url(video, audio) {
      const mod = await opcional("btch-downloader");
      if (!mod) return null;
      const fn = mod.youtube || mod.ytdl;
      if (typeof fn !== "function") return null;
      const datos = await fn(video.url);
      if (!datos?.status) return null;
      return (audio ? datos.mp3 : datos.mp4) || null;
    }
  }
];

/**
 * Consigue el archivo de un vídeo.
 *
 * @param {object} video datos de `buscar()`
 * @param {{audio: boolean}} opciones
 * @returns {Promise<{bytes: Buffer, proveedor: string, tipo: string}>}
 */
export async function archivo(video, { audio = true } = {}) {
  const fallos = [];

  for (const proveedor of PROVEEDORES) {
    try {
      const enlace = await proveedor.url(video, audio);
      if (!enlace) {
        fallos.push(`${proveedor.nombre}: sin enlace`);
        continue;
      }
      const { bytes, tipo } = await traerBytes(enlace);
      const esperado = audio ? /audio|octet-stream/i : /video|octet-stream/i;
      if (!esperado.test(tipo)) {
        fallos.push(`${proveedor.nombre}: entregó ${tipo || "otra cosa"}`);
        continue;
      }
      return { bytes, proveedor: proveedor.nombre, tipo };
    } catch (error) {
      fallos.push(`${proveedor.nombre}: ${error.message}`);
    }
  }

  // Último recurso: el programa de siempre.
  if (await hayYtdlp()) {
    try {
      const datos = await descargarConYtdlp(video.url, { audio });
      return { bytes: datos.bytes, proveedor: "yt-dlp", tipo: audio ? "audio/mpeg" : "video/mp4" };
    } catch (error) {
      fallos.push(`yt-dlp: ${error.message}`);
    }
  } else {
    fallos.push("yt-dlp: no está instalado");
  }

  const detalle = fallos.slice(0, 4).join("\n· ");
  throw new Error(
    `ninguna fuente lo entregó:\n· ${detalle}\n\n` +
      "En un servidor YouTube suele bloquear la descarga; en Termux va mejor."
  );
}

/**
 * Datos de un vídeo sin descargarlo.
 * Usa yt-search y, si no está, cae a yt-dlp.
 */
export async function datos(video) {
  if (await busqueda()) {
    const encontrado = await buscar(video.url || video);
    if (encontrado) return encontrado;
  }
  if (await hayYtdlp()) {
    const datosYtdlp = await infoConYtdlp(video.url || video);
    return {
      titulo: datosYtdlp.titulo,
      url: video.url || video,
      autor: datosYtdlp.autor || "",
      duracion: datosYtdlp.duracion || 0,
      segundos: datosYtdlp.duracion || 0,
      vistas: datosYtdlp.vistas || 0,
      miniatura: "",
      descripcion: ""
    };
  }
  throw new Error("no hay con qué leer los datos: instala *yt-search* o *yt-dlp*");
}

/** ¿Hay al menos una fuente de descarga disponible? */
export async function hayFuentes() {
  if (await busqueda()) return true;
  return hayYtdlp();
}

/** Nombres de las fuentes disponibles, para mostrarlas en los comandos. */
export async function fuentesDisponibles() {
  const lista = [];
  if (await busqueda()) lista.push("yt-search");
  for (const nombre of ["@vreden/youtube_scraper", "btch-downloader"]) {
    if (await opcional(nombre)) lista.push(nombre.split("/").pop());
  }
  if (await hayYtdlp()) lista.push("yt-dlp");
  return lista;
}

export default { buscar, datos, archivo, hayFuentes, fuentesDisponibles, TOPE_MB };
