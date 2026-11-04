/**
 * Tomate ofc bot — pokémon.
 *
 * Los datos salen de PokéAPI (pública, sin clave). La colección se guarda por
 * usuario: `equipo` son los que pelean y `caja` el resto.
 */

import { azar, elegir, monedas, nombreCorto, pedirJson, recortar } from "../src/utils.js";

/** Atrapados pendientes de asignar en cada chat: chat → {id, de, cuando}. */
const pendientes = new Map();

const TIPOS = ["fuego", "agua", "planta", "eléctrico", "tierra", "volador", "psíquico", "roca"];

/** Trae un pokémon de la API por id o nombre. */
async function buscar(consulta) {
  const datos = await pedirJson(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(consulta)}`, { tiempo: 15000 });
  return {
    id: datos.id,
    nombre: datos.name,
    tipos: datos.types.map((t) => t.type.name),
    altura: datos.height / 10,
    peso: datos.weight / 10,
    vida: datos.stats.find((s) => s.stat.name === "hp")?.base_stat || 50,
    ataque: datos.stats.find((s) => s.stat.name === "attack")?.base_stat || 50,
    defensa: datos.stats.find((s) => s.stat.name === "defense")?.base_stat || 50
  };
}

const precioBola = 300;

export default [
  {
    name: "pokemon",
    aliases: ["poke"],
    category: "pokemon",
    desc: "Ficha de un pokémon por nombre o número.",
    usage: "<nombre|número>",
    run: async ({ reply, text }) => {
      const consulta = (text || "").trim().toLowerCase();
      if (!consulta) return reply("🍅 Uso: .pokemon pikachu");
      try {
        const p = await buscar(consulta);
        return reply(
          `🍅 *#${p.id} ${p.nombre}*\n\n` +
            `· Tipos: *${p.tipos.join(", ")}*\n` +
            `· Altura: *${p.altura} m* · Peso: *${p.peso} kg*\n` +
            `· Vida: *${p.vida}* · Ataque: *${p.ataque}* · Defensa: *${p.defensa}*`
        );
      } catch (error) {
        return reply(`🍅 No encontré «${consulta}»: ${recortar(error.message, 120)}`);
      }
    }
  },
  {
    name: "pokedex",
    aliases: ["dex", "pokemondex"],
    category: "pokemon",
    desc: "Lo mismo que .pokemon, con otra entrada.",
    usage: "<nombre>",
    run: async ({ reply, text }) => {
      const consulta = (text || "").trim().toLowerCase();
      if (!consulta) return reply("🍅 Uso: .pokedex bulbasaur");
      try {
        const p = await buscar(consulta);
        return reply(`🍅 *#${p.id} ${p.nombre}* — ${p.tipos.join("/")}\nVida ${p.vida} · Ataque ${p.ataque} · Defensa ${p.defensa}`);
      } catch (error) {
        return reply(`🍅 No lo encontré: ${recortar(error.message, 120)}`);
      }
    }
  },
  {
    name: "atrapar",
    aliases: ["catch"],
    category: "pokemon",
    desc: "Intenta atrapar un pokémon salvaje.",
    run: async ({ reply, chat, msg, store }) => {
      const usuario = store.usuario(msg.sender);
      usuario.pokeballs = usuario.pokeballs || 0;
      if (usuario.pokeballs <= 0) {
        return reply("🍅 No te quedan pokéballs. Compra con *.pokeshop*");
      }
      usuario.pokeballs -= 1;
      const salvaje = azar(1, 151);
      const exito = azar(1, 100) <= 65;
      if (exito) {
        pendientes.set(chat, { id: salvaje, de: msg.sender, cuando: Date.now() });
        store.marcar();
        return reply(
          `🍅 ¡Atrapaste al *#${salvaje}*!\n\nGuárdalo en tu equipo con *.guardar* (o en la caja con *.caja*)`
        );
      }
      store.marcar();
      return reply(`🍅 El *#${salvaje}* se escapó. Te quedan *${usuario.pokeballs}* pokéballs.`);
    }
  },
  {
    name: "guardarpoke",
    aliases: ["alEquipo"],
    category: "pokemon",
    desc: "Guarda el pokémon atrapado en tu equipo.",
    run: async ({ reply, chat, msg, store }) => {
      const pendiente = pendientes.get(chat);
      if (!pendiente || pendiente.de !== msg.sender) return reply("🍅 No tienes un pokémon pendiente.");
      const usuario = store.usuario(msg.sender);
      usuario.pokemon.equipo = [...(usuario.pokemon.equipo || []), pendiente.id];
      store.marcar();
      pendientes.delete(chat);
      return reply(`🍅 *#${pendiente.id}* entró a tu equipo.`);
    }
  },
  {
    name: "caja",
    aliases: ["box"],
    category: "pokemon",
    desc: "Guarda el pokémon atrapado en la caja.",
    run: async ({ reply, chat, msg, store }) => {
      const pendiente = pendientes.get(chat);
      if (!pendiente || pendiente.de !== msg.sender) return reply("🍅 No tienes un pokémon pendiente.");
      const usuario = store.usuario(msg.sender);
      usuario.pokemon.caja = [...(usuario.pokemon.caja || []), pendiente.id];
      store.marcar();
      pendientes.delete(chat);
      return reply(`🍅 *#${pendiente.id}* quedó en la caja.`);
    }
  },
  {
    name: "pokeshop",
    aliases: ["poketienda"],
    category: "pokemon",
    desc: "Compra pokéballs con tomates.",
    usage: "[cantidad]",
    run: async ({ reply, store, msg, args }) => {
      const cuantas = Math.max(1, Math.min(20, Number(args[0]) || 1));
      const costo = cuantas * precioBola;
      const usuario = store.usuario(msg.sender);
      usuario.pokeballs = usuario.pokeballs || 0;
      if (usuario.coins < costo) {
        return reply(
          `🍅 *Pokéballs:* ${monedas(precioBola)} cada una.\nTe quedan *${usuario.pokeballs}*.\n` +
            `Para ${cuantas} necesitas *${monedas(costo)}*.`
        );
      }
      store.sumarCoins(msg.sender, -costo);
      usuario.pokeballs += cuantas;
      store.marcar();
      return reply(`🍅 Compraste *${cuantas}* pokéballs. Tienes *${usuario.pokeballs}*.`);
    }
  },
  {
    name: "miequipo",
    aliases: ["equipo"],
    category: "pokemon",
    desc: "Tu equipo pokémon.",
    run: async ({ reply, store, msg }) => {
      const quien = msg.quoted?.participant || msg.sender;
      const usuario = store.usuario(quien);
      const equipo = usuario.pokemon.equipo || [];
      const caja = usuario.pokemon.caja || [];
      return reply(
        `🍅 *Equipo de ${nombreCorto(quien)}*\n\n` +
          `· En equipo (${equipo.length}): ${equipo.map((id) => "#" + id).join(", ") || "vacío"}\n` +
          `· En caja (${caja.length}): ${caja.length ? caja.length + " pokémon" : "vacía"}\n` +
          `· Pokéballs: *${usuario.pokeballs || 0}*`
      );
    }
  },
  {
    name: "pokebatalla",
    aliases: ["combate"],
    category: "pokemon",
    desc: "Pelea con tu primer pokémon contra otro entrenador.",
    usage: "<@persona>",
    group: true,
    run: async ({ reply, store, msg, args }) => {
      const rival = msg.quoted?.participant || msg.mentionedJid?.[0] || (args[0] ? `${args[0].replace(/\D/g, "")}@s.whatsapp.net` : null);
      if (!rival || rival === msg.sender) return reply("🍅 Menciona o cita a tu rival.");
      const mio = store.usuario(msg.sender).pokemon.equipo?.[0];
      const suyo = store.usuario(rival).pokemon.equipo?.[0];
      if (!mio) return reply("🍅 No tienes pokémon en el equipo. Usa .atrapar");
      if (!suyo) return reply(`🍅 *${nombreCorto(rival)}* no tiene pokémon en el equipo.`);
      try {
        const [a, b] = await Promise.all([buscar(mio), buscar(suyo)]);
        const fuerzaA = a.ataque + a.defensa + azar(0, 40);
        const fuerzaB = b.ataque + b.defensa + azar(0, 40);
        const gana = fuerzaA >= fuerzaB;
        return reply(
          `🍅 *${a.nombre}* (${nombreCorto(msg.sender)}) vs *${b.nombre}* (${nombreCorto(rival)})\n\n` +
            `Ganador: *${gana ? a.nombre : b.nombre}* 🍅`
        );
      } catch (error) {
        return reply(`🍅 La PokéAPI no respondió: ${recortar(error.message, 120)}`);
      }
    }
  },
  {
    name: "soltar",
    aliases: ["liberar"],
    category: "pokemon",
    desc: "Suelta un pokémon de tu equipo.",
    usage: "<id>",
    run: async ({ reply, store, msg, args }) => {
      const id = Number(args[0]);
      const usuario = store.usuario(msg.sender);
      const equipo = usuario.pokemon.equipo || [];
      if (!equipo.includes(id)) return reply("🍅 Ese pokémon no está en tu equipo.");
      usuario.pokemon.equipo = equipo.filter((x) => x !== id);
      store.marcar();
      return reply(`🍅 Soltaste al *#${id}*.`);
    }
  },
  {
    name: "tipo",
    category: "pokemon",
    desc: "Ventajas de un tipo contra otro.",
    usage: "<tipo>",
    run: async ({ reply, text }) => {
      const tipo = (text || "").trim().toLowerCase();
      if (!TIPOS.includes(tipo)) return reply(`🍅 Tipos: ${TIPOS.join(", ")}`);
      const fuerte = {
        fuego: "planta", agua: "fuego", planta: "agua", electrico: "agua",
        tierra: "eléctrico", volador: "planta", psiquico: "fuego", roca: "volador"
      };
      const contra = elegir(TIPOS);
      const normalizado = tipo.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return reply(
        `🍅 *${tipo}*\n\n· Le gana a: *${fuerte[normalizado] || "depende del rival"}*\n` +
          `· Fuerte contra: *${contra}* (según la tabla clásica, resumida)`
      );
    }
  }
];
