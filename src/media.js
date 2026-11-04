/**
 * Tomate ofc bot — medios.
 *
 * Todo lo que toca archivos pasa por aquí: descargar lo que llega en un
 * mensaje, convertir a sticker y sacar la duración de un audio. La conversión
 * usa `ffmpeg` instalado en el sistema (en Termux: `pkg install ffmpeg`), y se
 * llama con `spawn` y argumentos separados —nunca con una cadena de shell—,
 * así que un nombre de archivo raro no puede convertirse en una orden.
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "./config.js";

/** ¿Hay ffmpeg disponible? Se comprueba una vez y se recuerda. */
let ffmpegCache = null;
export async function hayFfmpeg() {
  if (ffmpegCache !== null) return ffmpegCache;
  ffmpegCache = await new Promise((listo) => {
    const proceso = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
    proceso.on("error", () => listo(false));
    proceso.on("close", (codigo) => listo(codigo === 0));
  });
  return ffmpegCache;
}

/** Archivo temporal único dentro de `tmp/`. */
async function temporal(extension) {
  await fs.mkdir(config.rutas.temporales, { recursive: true });
  return path.join(config.rutas.temporales, `${crypto.randomUUID()}.${extension}`);
}

/** Ejecuta ffmpeg con argumentos separados y devuelve su salida de error. */
function ejecutarFfmpeg(argumentos, { tiempo = 60000 } = {}) {
  return new Promise((resolver, rechazar) => {
    const proceso = spawn("ffmpeg", argumentos, { stdio: ["ignore", "ignore", "pipe"] });
    let error = "";
    proceso.stderr.on("data", (trozo) => {
      error += trozo.toString();
      if (error.length > 8000) error = error.slice(-8000);
    });
    const reloj = setTimeout(() => {
      proceso.kill("SIGKILL");
      rechazar(new Error("la conversión tardó demasiado"));
    }, tiempo);
    proceso.on("error", (fallo) => {
      clearTimeout(reloj);
      rechazar(fallo.code === "ENOENT" ? new Error("ffmpeg no está instalado") : fallo);
    });
    proceso.on("close", (codigo) => {
      clearTimeout(reloj);
      if (codigo === 0) resolver();
      else rechazar(new Error(`ffmpeg falló (código ${codigo}): ${error.split("\n").slice(-3).join(" ")}`));
    });
  });
}

/**
 * Descarga el medio de un mensaje (o de un mensaje citado) a un Buffer.
 *
 * @param {object} sock socket de WhatsApp
 * @param {object} mensaje mensaje completo con `message`
 * @param {string} [que] "image" | "video" | "audio" | "document" | "sticker"
 * @returns {Promise<Buffer>}
 */
export async function descargarMedia(sock, mensaje, que = "") {
  if (!mensaje?.message) throw new Error("el mensaje no trae contenido");
  const { downloadMediaMessage, getContentType } = await import("@whiskeysockets/baileys");
  const tipo = getContentType(mensaje.message);
  if (que && !String(tipo).toLowerCase().includes(que)) {
    throw new Error(`esperaba un ${que} y llegó ${tipo || "otra cosa"}`);
  }
  const bytes = await downloadMediaMessage(
    mensaje,
    "buffer",
    {},
    { logger: { info() {}, debug() {}, warn() {}, error() {}, trace() {}, child() { return this; } }, reuploadRequest: sock.updateMediaMessage }
  );
  if (!bytes?.length) throw new Error("el medio llegó vacío");
  return Buffer.from(bytes);
}

/**
 * Convierte una imagen o un vídeo en sticker WebP de 512×512.
 *
 * @param {Buffer} bytes
 * @param {{video?: boolean, pack?: string, author?: string}} opciones
 * @returns {Promise<Buffer>}
 */
export async function aSticker(bytes, { video = false, pack = "Tomate ofc bot", author = "" } = {}) {
  if (!(await hayFfmpeg())) throw new Error("ffmpeg no está instalado");
  const entrada = await temporal(video ? "mp4" : "img");
  const salida = await temporal("webp");
  // `-` en el nombre del filtro va como un argumento más: nada se interpola.
  const vuelo = video ? 6 : 1;
  try {
    await fs.writeFile(entrada, bytes);
    await ejecutarFfmpeg([
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-i", entrada,
      "-vcodec", "libwebp",
      "-vf", "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000",
      "-loop", "0",
      "-ss", "0",
      "-t", String(vuelo),
      "-preset", "default",
      "-an",
      "-vsync", "0",
      salida
    ]);
    const sticker = await fs.readFile(salida);
    if (!sticker.length) throw new Error("el sticker salió vacío");
    return await conExif(sticker, pack, author);
  } finally {
    await fs.rm(entrada, { force: true });
    await fs.rm(salida, { force: true });
  }
}

/**
 * Añade el paquete y el autor al sticker (son los datos que ve WhatsApp al
 * abrirlo). Se escribe a mano el bloque EXIF de WebP; si falla, se devuelve el
 * sticker sin metadatos antes que romper el comando.
 */
async function conExif(webp, pack, author) {
  try {
    const datos = {
      "sticker-pack-name": pack,
      "sticker-pack-publisher": author || config.nombre,
      "emojis": ["🍅"]
    };
    const json = Buffer.from(JSON.stringify(datos), "utf8");
    // Cabecera EXIF de WebP: "Exif\0\0" + TIFF little-endian con un tag 0x5741.
    const cabecera = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
    cabecera.writeUInt32LE(json.length, 14);
    const exif = Buffer.concat([Buffer.from("Exif"), Buffer.alloc(2), cabecera, json]);
    const trozo = Buffer.alloc(8);
    trozo.write("EXIF", 0, "ascii");
    trozo.writeUInt32LE(exif.length, 4);
    const cuerpo = Buffer.concat([trozo, exif]);
    if (cuerpo.length % 2) {
      return Buffer.concat([webp.subarray(0, 12), cuerpo, Buffer.alloc(1), webp.subarray(12)]);
    }
    return Buffer.concat([webp.subarray(0, 12), cuerpo, webp.subarray(12)]);
  } catch {
    return webp;
  }
}

/**
 * Convierte cualquier audio a nota de voz OGG/Opus, que es lo que WhatsApp
 * dibuja con la forma de onda.
 */
export async function aNotaDeVoz(bytes) {
  if (!(await hayFfmpeg())) throw new Error("ffmpeg no está instalado");
  const entrada = await temporal("audio");
  const salida = await temporal("ogg");
  try {
    await fs.writeFile(entrada, bytes);
    await ejecutarFfmpeg([
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", entrada,
      "-vn", "-map_metadata", "-1",
      "-c:a", "libopus", "-b:a", "64k", "-ar", "48000", "-ac", "1",
      "-f", "ogg",
      salida
    ]);
    return await fs.readFile(salida);
  } finally {
    await fs.rm(entrada, { force: true });
    await fs.rm(salida, { force: true });
  }
}

/**
 * Convierte un sticker WebP en imagen PNG.
 *
 * WhatsApp entrega los stickers como WebP animado o estático; PNG es lo que
 * cualquier cliente dibuja como foto. Se manda el primer cuadro.
 */
export async function aImagen(bytes) {
  if (!(await hayFfmpeg())) throw new Error("ffmpeg no está instalado");
  const entrada = await temporal("webp");
  const salida = await temporal("png");
  try {
    await fs.writeFile(entrada, bytes);
    await ejecutarFfmpeg([
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", entrada,
      "-frames:v", "1",
      "-f", "image2",
      salida
    ]);
    const imagen = await fs.readFile(salida);
    if (!imagen.length) throw new Error("la imagen salió vacía");
    return imagen;
  } finally {
    await fs.rm(entrada, { force: true });
    await fs.rm(salida, { force: true });
  }
}

/** Duración en segundos de un archivo de audio. `null` si no se puede saber. */
export async function duracionAudio(bytes) {
  if (!(await hayFfmpeg())) return null;
  const entrada = await temporal("audio");
  try {
    await fs.writeFile(entrada, bytes);
    const salida = await new Promise((resolver, rechazar) => {
      const proceso = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", entrada]);
      let datos = "";
      proceso.stdout.on("data", (trozo) => {
        datos += trozo.toString();
      });
      proceso.on("error", rechazar);
      proceso.on("close", () => resolver(datos.trim()));
    });
    const segundos = Number(String(salida).replace(",", "."));
    return Number.isFinite(segundos) ? segundos : null;
  } catch {
    return null;
  } finally {
    await fs.rm(entrada, { force: true });
  }
}

/** Carpeta temporal del sistema, por si algún comando la necesita. */
export const tmpDir = () => os.tmpdir();
