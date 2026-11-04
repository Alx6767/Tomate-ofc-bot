/**
 * Tomate ofc bot — vista previa del menú.
 *
 * Carga los plugins igual que el bot y pinta el menú en la consola, sin
 * conectarse a WhatsApp. Sirve para comprobar que un comando nuevo aparece y
 * que nada se rompió al tocarlo: `npm run menu`.
 */

import { cargarPlugins, porCategoria } from "../src/loader.js";
import { construirMenu } from "../src/menu.js";

const { comandos, lista, fallos } = await cargarPlugins();

console.log(construirMenu({ lista, usuarios: 0 }));
console.log("\n─────────────────────────────────────────────");
console.log(`Comandos: ${lista.length} · alias: ${comandos.size - lista.length}`);

const grupos = porCategoria(lista);
console.log("Categorías: " + grupos.map((g) => `${g.id}(${g.comandos.length})`).join(", "));

if (fallos.length) {
  console.log("\nPlugins con problemas:");
  for (const fallo of fallos) console.log(" ✗ " + fallo);
  process.exitCode = 1;
}
