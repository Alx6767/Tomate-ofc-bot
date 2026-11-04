/**
 * Tomate ofc bot — descargas con yt-dlp.
 *
 * yt-dlp es el único descargador que se mantiene al día con YouTube, TikTok,
 * Instagram y compañía. No viene con el bot: se instala aparte
 * (`pkg install python && pip install -U yt-dlp` en Termux, o el binario que
 * corresponda). Si no está, el comando lo dice con esas instrucciones en vez
 * de fallar sin explicación.
 *
 * Se ejecuta con `spawn` y argumentos separados: la URL nunca se concatena a
 * una orden de shell.
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "./config.js";

/** ¿Está yt-dlp disponible? */
let cache = null;
export async function hayYtdlp() {
  if (cache !== null) return cache;
  cache = await new Promise((listo) => {
    const proceso = spawn("yt-dlp", ["--version"], { stdio: "ignore" });
    proceso.on("error", () => listo(false));
    proceso.on("close", (codigo) => listo(codigo === 0));
  });
  return cache;
}

/** Ejecuta yt-dlp y devuelve la salida de error si falla. */
function ejecutar(argumentos, { tiempo = 120000 } = {}) {
  return new Promise((resolver, rechazar) => {
    const proceso = spawn("yt-dlp", argumentos, { stdio: ["ignore", "pipe", "pipe"] });
    let salida = "";
    let error = "";
    proceso.stdout.on("data", (t) => {
      salida += t.toString();
    });
    proceso.stderr.on("data", (t) => {
      error += t.toString();
      if (error.length > 4000) error = error.slice(-4000);
    });
    const reloj = setTimeout(() => {
      proceso.kill("SIGKILL");
      rechazar(new Error("la descarga tardó demasiado"));
    }, tiempo);
    proceso.on("error", (fallo) => {
      clearTimeout(reloj);
      rechazar(fallo.code === "ENOENT" ? new Error("yt-dlp no está instalado") : fallo);
    });
    proceso.on("close", (codigo) => {
      clearTimeout(reloj);
      if (codigo === 0) resolver(salida);
      else rechazar(new Error(limpiarError(error)));
    });
  });
}

/** Deja el error de yt-dlp en una línea corta y legible. */
function limpiarError(texto) {
  const linea = String(texto)
    .split("\n")
    .map((l) => l.replace(/^ERROR:\s*/i, "").trim())
    .filter(Boolean)
    .pop();
  return linea || "yt-dlp falló sin decir por qué";
}

/** Tope de tamaño de descarga (60 MB por defecto). */
const TOPE_MB = 60;

/**
 * Descarga un enlace.
 *
 * @param {string} url
 * @param {{audio?: boolean, tiempo?: number}} opciones
 * @returns {Promise<{bytes: Buffer, titulo: string, autor: string, duracion: number, extension: string}>}
 */
export async function descargar(url, { audio = false, tiempo = 120000 } = {}) {
  if (!(await hayYtdlp())) {
    throw new Error("falta yt-dlp. Instálalo con: pip install -U yt-dlp (o pkg install yt-dlp)");
  }

  await fs.mkdir(config.rutas.temporales, { recursive: true });
  const base = path.join(config.rutas.temporales, crypto.randomUUID());
  const salida = `${base}.%(ext)s`;

  // Primero los metadatos: así el mensaje puede decir qué se está bajando y
  // se evita descargar algo enorme sin avisar.
  const crudo = await ejecutar(["--no-playlist", "--no-warnings", "-J", url], { tiempo: 60000 });
  const datos = JSON.parse(crudo);

  const argumentos = [
    "--no-playlist",
    "--no-warnings",
    "--no-progress",
    "--max-filesize", `${TOPE_MB}M`,
    "-o", salida
  ];
  if (audio) argumentos.push("-f", "bestaudio", "-x", "--audio-format", "mp3");
  else argumentos.push("-f", "mp4/best", "--merge-output-format", "mp4");

  await ejecutar([...argumentos, url], { tiempo });

  const nombreBase = path.basename(base);
  const archivos = (await fs.readdir(path.dirname(base))).filter((f) => f.startsWith(nombreBase));
  if (!archivos.length) throw new Error("la descarga terminó pero no dejó archivo");

  const archivo = path.join(path.dirname(base), archivos[0]);
  const bytes = await fs.readFile(archivo);
  await Promise.all(archivos.map((f) => fs.rm(path.join(path.dirname(base), f), { force: true })));

  return {
    bytes,
    titulo: datos.title || "sin título",
    autor: datos.uploader || datos.channel || "",
    duracion: Number(datos.duration || 0),
    extension: path.extname(archivo).slice(1) || "mp4"
  };
}

/** Metadatos sin descargar (para mostrar antes de bajar 60 MB). */
export async function info(url, { tiempo = 45000 } = {}) {
  if (!(await hayYtdlp())) {
    throw new Error("falta yt-dlp. Instálalo con: pip install -U yt-dlp");
  }
  const crudo = await ejecutar(["--no-playlist", "--no-warnings", "-J", url], { tiempo });
  const datos = JSON.parse(crudo);
  return {
    titulo: datos.title || "sin título",
    autor: datos.uploader || datos.channel || "",
    duracion: Number(datos.duration || 0),
    miniatura: datos.thumbnail || "",
    vistas: Number(datos.view_count || 0)
  };
}
