/**
 * Tomate ofc bot — álbum y colecciones.
 *
 * WhatsApp no tiene un «mensaje álbum» en la librería que usa el bot: lo que
 * hace el teléfono es mandar varias fotos seguidas y agruparlas él mismo. Eso
 * es exactamente lo que hace este comando, y se dice así en el texto para no
 * prometer una cuadrícula que depende del cliente.
 */

import { azar, elegir, nombreCorto, pedirBytes, recortar } from "../src/utils.js";

/** Imágenes acumuladas para el álbum: chat → { de, fotos: [] } */
const bulto = new Map();

/** Monstruos del álbum (inventados). */
const MONSTRUOS = [
  { nombre: "Tomate Rex", rareza: 5 }, { nombre: "Jitomate Espectral", rareza: 4 },
  { nombre: "Salsa Viva", rareza: 3 }, { nombre: "Pepino Errante", rareza: 2 },
  { nombre: "Cebolla Ninja", rareza: 4 }, { nombre: "Chile Fantasma", rareza: 5 },
  { nombre: "Lechuga Durmiente", rareza: 1 }, { nombre: "Zanahoria Veloz", rareza: 2 }
];

const estrellas = (r) => "★".repeat(r) + "☆".repeat(5 - r);

export default [
  {
    name: "album",
    aliases: ["albumes"],
    category: "album",
    desc: "Junta imágenes y las manda seguidas para que WhatsApp las agrupe.",
    usage: "[fin|vaciar]",
    run: async ({ reply, chat, msg, send, text, descargar }) => {
      const accion = text.trim().toLowerCase();
      const acumulado = bulto.get(chat) || { de: msg.sender, fotos: [] };

      if (accion === "vaciar") {
        bulto.delete(chat);
        return reply("🍅 Álbum vaciado.");
      }

      if (!msg.quoted?.quotedMessage?.imageMessage && msg.mediaType !== "imageMessage") {
        if (accion === "fin") {
          if (acumulado.fotos.length < 2) return reply("🍅 Necesito al menos dos imágenes.");
          for (const [i, foto] of acumulado.fotos.entries()) {
            await send(chat, { image: foto, caption: i === 0 ? "🍅 Álbum" : "" });
          }
          bulto.delete(chat);
          return true;
        }
        return reply(
          "🍅 Cita una imagen y usa *.album* para ir juntando.\n" +
            "Cuando tengas dos o más, escribe *.album fin*."
        );
      }

      try {
        const bytes = await descargar("image");
        acumulado.fotos.push(bytes);
        acumulado.de = msg.sender;
        bulto.set(chat, acumulado);
        return reply(
          `🍅 Imagen *${acumulado.fotos.length}* guardada.\n` +
            (acumulado.fotos.length >= 2 ? "Escribe *.album fin* para mandarlas." : "Cita otra y repite.")
        );
      } catch (error) {
        return reply(`🍅 No pude leer la imagen: ${recortar(error.message, 120)}`);
      }
    }
  },
  {
    name: "atraparm",
    aliases: ["monstruo"],
    category: "album",
    desc: "Atrapa un monstruo del álbum del huerto.",
    run: async ({ reply, store, msg }) => {
      const usuario = store.usuario(msg.sender);
      const monstruo = elegir(MONSTRUOS);
      const exito = azar(1, 100) <= 55;
      if (!exito) return reply("🍅 El monstruo se escondió entre las hojas. Otra vez será.");
      usuario.monstruos = [...(usuario.monstruos || []), monstruo.nombre];
      store.marcar();
      return reply(
        `🍅 ¡Atrapaste a *${monstruo.nombre}*! ${estrellas(monstruo.rareza)}\n\n` +
          `Llevas *${usuario.monstruos.length}* monstruos.`
      );
    }
  },
  {
    name: "misMonstruos",
    aliases: ["monstruos"],
    category: "album",
    desc: "Tu colección de monstruos.",
    run: async ({ reply, store, msg }) => {
      const monstros = store.usuario(msg.sender).monstruos || [];
      if (!monstros.length) return reply("🍅 Todavía no tienes monstruos. Usa *.atraparm*");
      const cuenta = new Map();
      for (const m of monstros) cuenta.set(m, (cuenta.get(m) || 0) + 1);
      const lista = [...cuenta.entries()].map(([nombre, cuantos]) => `· ${nombre} ×${cuantos}`).join("\n");
      return reply(`🍅 *Monstruos de ${msg.pushName || nombreCorto(msg.sender)}*\n\n${lista}`);
    }
  },
  {
    name: "mundialroll",
    aliases: ["rollmundial"],
    category: "album",
    desc: "Tirada especial: solo salen personajes de 4 y 5 estrellas.",
    run: async ({ reply, store, msg }) => {
      const fsMod = await import("node:fs");
      const path = await import("node:path");
      const { RAIZ } = await import("../src/config.js");
      let catalogo = [];
      try {
        const crudo = fsMod.readFileSync(path.join(RAIZ, "data", "personajes.json"), "utf8");
        catalogo = JSON.parse(crudo).personajes.filter((p) => p.rareza >= 4);
      } catch {
        return reply("🍅 No pude leer el catálogo.");
      }
      if (!catalogo.length) return reply("🍅 El catálogo no tiene personajes de 4 o 5 estrellas.");
      const usuario = store.usuario(msg.sender);
      const premio = elegir(catalogo);
      const nuevo = !usuario.gacha.reclamados.includes(premio.id);
      if (nuevo) {
        usuario.gacha.reclamados.push(premio.id);
        store.marcar();
      }
      return reply(
        `🍅 *Tirada especial*\n\n· *${premio.nombre}* ${estrellas(premio.rareza)}\n· ${premio.serie}\n\n` +
          (nuevo ? "¡Nuevo en tu colección!" : "Ya lo tenías, pero salió otra vez.")
      );
    }
  },
  {
    name: "albumurl",
    category: "album",
    desc: "Manda una imagen desde un enlace.",
    usage: "<url>",
    run: async ({ reply, send, chat, text }) => {
      if (!/^https?:\/\//i.test(text)) return reply("🍅 Pásame un enlace de imagen.");
      try {
        const bytes = await pedirBytes(text, { maximo: 16 * 1024 * 1024 });
        await send(chat, { image: bytes, caption: "🍅 Desde enlace" });
        return true;
      } catch (error) {
        return reply(`🍅 No pude bajarla: ${recortar(error.message, 140)}`);
      }
    }
  }
];
