/**
 * Tomate ofc bot — bitácora.
 *
 * Sin dependencias: colores ANSI a mano (se apagan solos si la salida no es
 * una terminal o si NO_COLOR está puesto) y una marca de tiempo corta.
 */

const usaColor = process.stdout.isTTY && !process.env.NO_COLOR;

const pintar = (codigo, texto) => (usaColor ? `\u001b[${codigo}m${texto}\u001b[0m` : String(texto));

const COLOR = {
  gris: (t) => pintar("90", t),
  rojo: (t) => pintar("31", t),
  verde: (t) => pintar("32", t),
  amarillo: (t) => pintar("33", t),
  azul: (t) => pintar("36", t),
  tomate: (t) => pintar("38;5;203", t),
  negrita: (t) => pintar("1", t)
};

/** Hora local en formato HH:MM:SS. */
const hora = () => new Date().toLocaleTimeString("es-MX", { hour12: false });

/** Un error nunca se traga: si no es un Error, se muestra tal cual. */
const textoDe = (algo) => {
  if (algo instanceof Error) return algo.stack || algo.message;
  if (typeof algo === "string") return algo;
  try {
    return JSON.stringify(algo);
  } catch {
    return String(algo);
  }
};

const escribir = (etiqueta, color, mensaje) => {
  console.log(`${COLOR.gris(hora())} ${color(etiqueta)} ${mensaje}`);
};

export const log = {
  info: (mensaje) => escribir("·", COLOR.azul, mensaje),
  ok: (mensaje) => escribir("✓", COLOR.verde, mensaje),
  aviso: (mensaje) => escribir("!", COLOR.amarillo, mensaje),
  error: (mensaje) => escribir("✗", COLOR.rojo, textoDe(mensaje)),
  tomate: (mensaje) => escribir("🍅", COLOR.tomate, mensaje),
  titulo: (mensaje) => console.log(COLOR.negrita(COLOR.tomate(mensaje)))
};

export default log;
