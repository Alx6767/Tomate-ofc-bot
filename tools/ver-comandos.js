/**
 * Tomate ofc bot — genera docs/COMANDOS.md.
 *
 * La lista se saca del registro real, así que nunca se queda vieja: si un
 * comando cambia, se regenera y ya está. Uso: `node tools/ver-comandos.js`
 */

import fs from "node:fs";
import path from "node:path";

import { cargarPlugins, CATEGORIAS, ORDEN_CATEGORIAS, porCategoria } from "../src/loader.js";
import { RAIZ } from "../src/config.js";

const { lista, fallos } = await cargarPlugins();
const grupos = porCategoria(lista);

const lineas = [
  "# 🍅 Comandos de Tomate ofc bot",
  "",
  `Total: **${lista.length}** comandos en **${grupos.length}** categorías.`,
  "",
  "Generado con `node tools/ver-comandos.js`. El prefijo del menú es `.`, pero",
  "también acepta `!` y `/`.",
  "",
  "| Categoría | Comandos |",
  "|---|---|",
  ...grupos.map((g) => `| ${g.titulo || CATEGORIAS[g.id]?.titulo || g.id} | ${g.comandos.length} |`),
  ""
];

for (const id of ORDEN_CATEGORIAS) {
  const grupo = grupos.find((g) => g.id === id);
  if (!grupo) continue;
  lineas.push(`## ${grupo.titulo || CATEGORIAS[id].titulo}`, "");
  lineas.push("| Comando | Qué hace | Uso |");
  lineas.push("|---|---|---|");
  for (const comando of grupo.comandos) {
    const nombre = comando.owner ? `**${comando.name}** 🔑` : comando.name;
    const uso = comando.usage ? `\`.${comando.name} ${comando.usage}\`` : `\`.${comando.name}\``;
    lineas.push(`| \`${nombre}\` | ${comando.desc} | ${uso} |`);
  }
  lineas.push("");
}

lineas.push("---", "", "🔑 = solo el dueño del bot (`OWNER` en el `.env`).", "");

fs.writeFileSync(path.join(RAIZ, "docs", "COMANDOS.md"), lineas.join("\n"), "utf8");
console.log(`docs/COMANDOS.md escrito: ${lista.length} comandos en ${grupos.length} categorías`);
if (fallos.length) {
  console.log("Plugins con problemas:");
  for (const fallo of fallos) console.log(" ✗ " + fallo);
  process.exitCode = 1;
}
