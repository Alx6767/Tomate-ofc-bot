/**
 * Tomate ofc bot — el menú.
 *
 * Se dibuja a partir de los comandos que existen de verdad. Si un plugin no
 * carga, su comando no aparece; si se añade uno, aparece solo. El número de
 * «PLUGINS» del encabezado es el conteo real, no una cifra escrita a mano.
 *
 * Los adornos (las letras góticas y las cajas) son solo texto: WhatsApp no
 * interpreta nada, así que no dependen del cliente.
 */

import { porCategoria, CATEGORIAS } from "./loader.js";
import { config } from "./config.js";
import { numero } from "./utils.js";

/** Letras matemáticas en negrita: A→𝕬, 1→𝟭. */
const BOLD_MAYUS = 0x1d5d4;
const BOLD_MINUS = 0x1d5ee;
const BOLD_DIGITO = 0x1d7ce;

/**
 * Convierte texto latino a letras negritas decorativas.
 * Lo que no sea A-Z, a-z o 0-9 se deja igual (espacios, guiones, emoji).
 */
export function glifo(texto) {
  // Los acentos se quitan antes de convertir: si no, «Á» se queda como esta y
  // el título sale con una letra distinta a las demás.
  const plano = String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return [...plano]
    .map((caracter) => {
      const codigo = caracter.codePointAt(0);
      if (codigo >= 65 && codigo <= 90) return String.fromCodePoint(BOLD_MAYUS + (codigo - 65));
      if (codigo >= 97 && codigo <= 122) return String.fromCodePoint(BOLD_MINUS + (codigo - 97));
      if (codigo >= 48 && codigo <= 57) return String.fromCodePoint(BOLD_DIGITO + (codigo - 48));
      return caracter;
    })
    .join("");
}

/**
 * Letras separadas por un espacio, para los separadores.
 * Los espacios del texto se conservan tal cual: solo se separan las letras.
 */
export const glifoEspaciado = (texto) =>
  [...glifo(texto)].map((caracter) => (caracter === " " ? "  " : `${caracter} `)).join("").trimEnd();

/** Viñetas por categoría, como en el menú de referencia. */
const VINETAS = ["𓀪𝕯", "⚰️", "♰"];
const vineta = (indice) => ["𓆩𝕯𓆪", "𓆩⚰️𓆪", "𓆩♰𓆪"][indice % 3] || VINETAS[0];

/** Moneda del bot para el menú RPG. */
const TOMATE = "🍅";

/**
 * Construye el menú completo.
 *
 * @param {object} opciones
 * @param {object[]} opciones.lista comandos cargados
 * @param {number} [opciones.usuarios] usuarios registrados
 * @param {string} [opciones.prefijo] prefijo a mostrar en los ejemplos
 * @param {string} [opciones.nombre] nombre que firmará el encabezado
 * @param {boolean} [opciones.soloRpg] si es el menú de economía
 * @returns {string}
 */
export function construirMenu({
  lista = [],
  usuarios = 0,
  prefijo = config.prefijos[0],
  nombre = config.nombre,
  soloRpg = false
} = {}) {
  const grupos = porCategoria(lista).filter((grupo) =>
    soloRpg ? ["economia", "gacha", "perfil", "juegos"].includes(grupo.id) : true
  );

  const total = lista.length;
  const ancho = 30;
  const linea = (texto) => `│ ${texto}`;
  const cajaArriba = (titulo) => `╭─𓆩𝕻𝕬𝕾𝕰𝕾𓆪 ${glifo(titulo)} 𓆩𝕻𝕬𝕾𝕰𝕾𓆪─╮`;
  const cajaAbajo = (largo = ancho) => `╰${"─".repeat(largo)}╯`;

  const partes = [];

  // ── Encabezado ────────────────────────────────────────────────────
  partes.push(`> ${glifo(nombre).toUpperCase()}`);
  partes.push(`~_${soloRpg ? "Economía, RPG y colecciones." : "Bienvenido a mi menú de comandos."}_ ${config.emoji}`);
  partes.push("");
  partes.push(`╭─── ${glifo("Tomate ofc")} ───╮`);
  partes.push(`𓆩✟𓆪  PLUGINS : ${numero(total)}`);
  partes.push(`𓆩✟𓆪  USERS   : ${numero(usuarios)}`);
  partes.push(`𓆩✟𓆪  EDITION :${TOMATE}`);
  partes.push(`𓆩✟𓆪  PREFIX  : ${config.prefijos.join(" ")}`);
  partes.push(cajaAbajo(30));
  partes.push("");
  partes.push(`─── ⋆ ${glifoEspaciado(soloRpg ? "RPG" : "Larosa Menu")} ⋆ ───`);
  partes.push("");

  // ── Categorías ────────────────────────────────────────────────────
  for (const [indice, grupo] of grupos.entries()) {
    partes.push(cajaArriba(grupo.titulo));
    for (const comando of grupo.comandos) {
      partes.push(linea(`${vineta(indice)} ${glifo("N")} ${comando.name}`));
    }
    partes.push(cajaAbajo(Math.max(26, Math.min(32, grupo.titulo.length + 12))));
    partes.push("");
  }

  // ── Pie ───────────────────────────────────────────────────────────
  partes.push(`> ${config.emoji} *${config.nombre}* · usa ${prefijo}help <comando> para el detalle.`);
  if (config.enlaces.canal) partes.push(`> 📣 Canal: ${config.enlaces.canal}`);
  if (config.enlaces.grupo) partes.push(`> 👥 Grupo: ${config.enlaces.grupo}`);
  partes.push(`> 🧩 ${numero(total)} comandos · ${numero(grupos.length)} categorías`);

  return partes.join("\n");
}

/** Ficha de un comando concreto. */
export function fichaComando(comando, prefijo = config.prefijos[0]) {
  if (!comando) return null;
  const lineas = [
    `> ${config.emoji} *${glifo(comando.name)}*`,
    "",
    `*Categoría:* ${CATEGORIAS[comando.category] || comando.category}`,
    `*Uso:* ${prefijo}${comando.name}${comando.usage ? " " + comando.usage : ""}`,
    `*Qué hace:* ${comando.desc || "sin descripción"}`
  ];
  if (comando.aliases?.length) lineas.push(`*Atajos:* ${comando.aliases.join(", ")}`);
  const permisos = [];
  if (comando.owner) permisos.push("solo dueño");
  if (comando.mod) permisos.push("moderador");
  if (comando.admin) permisos.push("admin del grupo");
  if (comando.botAdmin) permisos.push("el bot debe ser admin");
  if (comando.group) permisos.push("solo grupos");
  if (comando.private) permisos.push("solo privado");
  if (comando.nsfw) permisos.push("+18");
  if (permisos.length) lineas.push(`*Requiere:* ${permisos.join(", ")}`);
  return lineas.join("\n");
}

export default construirMenu;
