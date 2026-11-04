/**
 * Tomate ofc bot — menús.
 *
 * `menu` y `menurpg` se dibujan solos a partir de los plugins cargados; este
 * archivo solo los publica. `help` muestra la ficha de un comando concreto.
 */

import { construirMenu, fichaComando } from "../src/menu.js";

export default [
  {
    name: "menu",
    aliases: ["help", "ayuda", "comandos"],
    category: "menu",
    desc: "Muestra todos los comandos agrupados por categoría.",
    usage: "[comando]",
    run: async ({ reply, lista, args, menu }) => {
      if (args[0]) {
        const ficha = fichaComando(
          lista.find((c) => c.name === args[0].toLowerCase()),
          "."
        );
        return reply(ficha || `🍅 No existe el comando *${args[0]}*.`);
      }
      return reply(menu());
    }
  },
  {
    name: "menurpg",
    aliases: ["menueco"],
    category: "menu",
    desc: "Menú corto con lo de economía, RPG, gacha y perfil.",
    run: async ({ reply, lista, store }) => {
      return reply(
        construirMenu({
          lista,
          usuarios: Object.keys(store.datos.usuarios).length,
          soloRpg: true
        })
      );
    }
  }
];
