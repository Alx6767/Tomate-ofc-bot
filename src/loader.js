/**
 * Tomate ofc bot — cargador de plugins.
 *
 * Un plugin es un archivo dentro de `plugins/` que exporta (por defecto) un
 * objeto de comando o una lista de ellos. Nada más. No hay registro central
 * que mantener: si el archivo está, el comando existe; si se borra, deja de
 * existir y desaparece del menú.
 *
 * Cada comando se valida al cargar. Un plugin roto se queda fuera con un
 * aviso en la consola en vez de tumbar el arranque entero: es preferible un
 * bot con 199 comandos a un bot que no arranca por uno mal escrito.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import log from "./logger.js";
import { RAIZ } from "./config.js";

/** Categorías conocidas y el título que se pinta en el menú. */
export const CATEGORIAS = Object.freeze({
  menu: "MENÚS",
  juegos: "JUEGOS & DIVERSIÓN",
  economia: "ECONOMÍA & RPG",
  utils: "ÚTILES",
  perfil: "PERFIL",
  descargas: "DESCARGAS",
  owner: "OWNER",
  grupo: "GRUPO",
  subbots: "SUBBOTS",
  gacha: "GACHA",
  info: "INFO",
  pokemon: "POKEMON",
  ia: "INTELIGENCIA ARTIFICIAL",
  minijuegos: "MINIJUEGOS",
  album: "ÁLBUM",
  nsfw: "NSFW",
  stickers: "STICKERS"
});

/** Orden en el que se pintan las categorías en el menú. */
export const ORDEN_CATEGORIAS = Object.freeze([
  "menu",
  "juegos",
  "economia",
  "utils",
  "perfil",
  "descargas",
  "owner",
  "grupo",
  "subbots",
  "gacha",
  "info",
  "pokemon",
  "ia",
  "minijuegos",
  "album",
  "stickers",
  "nsfw"
]);

/** Revisa un comando y devuelve la lista de problemas (vacía si está bien). */
export function validarComando(comando) {
  const problemas = [];
  if (!comando || typeof comando !== "object") return ["no es un objeto"];
  if (typeof comando.name !== "string" || !comando.name.trim()) problemas.push("sin `name`");
  if (typeof comando.run !== "function") problemas.push("sin función `run`");
  if (comando.category && !CATEGORIAS[comando.category]) {
    problemas.push(`categoría desconocida: ${comando.category}`);
  }
  if (comando.aliases && !Array.isArray(comando.aliases)) problemas.push("`aliases` no es una lista");
  return problemas;
}

/**
 * Carga todos los plugins de una carpeta.
 *
 * @param {string} carpeta ruta a `plugins/`
 * @returns {Promise<{comandos: Map<string, object>, lista: object[], fallos: string[]}>}
 */
export async function cargarPlugins(carpeta = path.join(RAIZ, "plugins")) {
  const comandos = new Map();
  const lista = [];
  const fallos = [];

  let archivos;
  try {
    archivos = fs
      .readdirSync(carpeta)
      .filter((archivo) => archivo.endsWith(".js"))
      .sort((a, b) => a.localeCompare(b, "es"));
  } catch (error) {
    return { comandos, lista, fallos: [`no se pudo leer ${carpeta}: ${error.message}`] };
  }

  for (const archivo of archivos) {
    const ruta = path.join(carpeta, archivo);
    let modulo;
    try {
      modulo = await import(pathToFileURL(ruta).href);
    } catch (error) {
      fallos.push(`${archivo}: no se pudo importar (${error.message})`);
      continue;
    }

    const exportado = modulo.default ?? modulo.comandos ?? modulo.commands;
    const crudos = Array.isArray(exportado) ? exportado : [exportado];
    if (!exportado) {
      fallos.push(`${archivo}: no exporta comandos`);
      continue;
    }

    for (const crudo of crudos) {
      const problemas = validarComando(crudo);
      if (problemas.length) {
        fallos.push(`${archivo}: ${crudo?.name || "comando sin nombre"} → ${problemas.join(", ")}`);
        continue;
      }

      const comando = {
        category: "utils",
        aliases: [],
        desc: "",
        usage: "",
        owner: false,
        mod: false,
        admin: false,
        botAdmin: false,
        group: false,
        private: false,
        nsfw: false,
        cooldown: 0,
        ...crudo,
        name: crudo.name.trim().toLowerCase(),
        aliases: (crudo.aliases || []).map((alias) => String(alias).trim().toLowerCase()).filter(Boolean)
      };

      const choque = [comando.name, ...comando.aliases].find((nombre) => comandos.has(nombre));
      if (choque) {
        // No se permite adivinar: dos plugins con el mismo nombre es un error
        // del proyecto, y el segundo en orden alfabético es el que se calla.
        fallos.push(`${archivo}: el nombre «${choque}» ya lo usa ${comandos.get(choque).name}`);
        continue;
      }

      comandos.set(comando.name, comando);
      for (const alias of comando.aliases) comandos.set(alias, comando);
      lista.push(comando);
    }
  }

  return { comandos, lista, fallos };
}

/**
 * Comandos agrupados por categoría, en el orden del menú.
 * @returns {Array<{id: string, titulo: string, comandos: object[]}>}
 */
export function porCategoria(lista) {
  const grupos = new Map();
  for (const comando of lista) {
    if (!grupos.has(comando.category)) grupos.set(comando.category, []);
    grupos.get(comando.category).push(comando);
  }
  return ORDEN_CATEGORIAS.filter((id) => grupos.has(id)).map((id) => ({
    id,
    titulo: CATEGORIAS[id],
    comandos: grupos.get(id).sort((a, b) => a.name.localeCompare(b.name, "es"))
  }));
}

export default cargarPlugins;
