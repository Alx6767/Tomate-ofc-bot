/**
 * Tomate ofc bot — información del bot y del entorno.
 */

import os from "node:os";
import { config } from "../src/config.js";
import { fecha, hora, numero, pedirJson, duracion, recortar } from "../src/utils.js";

const ARRANQUE = Date.now();

/** Quita la parte fea del JID para mostrarla. */
const corto = (jid) => String(jid || "").split("@")[0].split(":")[0];

export default [
  {
    name: "ping",
    aliases: ["p"],
    category: "info",
    desc: "Mide cuánto tarda el bot en responder.",
    run: async ({ reply }) => {
      const inicio = Date.now();
      const enviado = await reply("🍅 midiendo…");
      const latencia = Date.now() - inicio;
      const memoria = process.memoryUsage().rss / 1048576;
      await reply(
        `🍅 *Pong*\n\n` +
          `· Latencia: *${latencia} ms*\n` +
          `· Activo: *${duracion(Date.now() - ARRANQUE)}*\n` +
          `· Memoria: *${memoria.toFixed(0)} MB*\n` +
          `· Node: *${process.version}*`
      );
      return enviado;
    }
  },
  {
    name: "botinfo",
    aliases: ["info"],
    category: "info",
    desc: "Ficha del bot: versión, sistema, comandos y dueños.",
    run: async ({ reply, lista, store, sock }) => {
      const usuarios = Object.keys(store.datos.usuarios).length;
      return reply(
        `🍅 *${config.nombre}*\n\n` +
          `· Versión: *1.0.0*\n` +
          `· Comandos: *${numero(lista.length)}*\n` +
          `· Usuarios: *${numero(usuarios)}*\n` +
          `· Dueños: *${config.owners.map(corto).join(", ") || "sin configurar"}*\n` +
          `· Cuenta: *${corto(sock.user?.id)}*\n` +
          `· Sistema: *${os.type()} ${os.arch()}*\n` +
          `· Node: *${process.version}*\n` +
          `· Encendido: *${duracion(Date.now() - ARRANQUE)}*\n` +
          `· Repo: ${config.enlaces.repo}`
      );
    }
  },
  {
    name: "creador",
    aliases: ["owner", "dueño"],
    category: "info",
    desc: "Quién hizo y mantiene el bot.",
    run: async ({ reply }) => {
      const duenos = config.owners.length
        ? config.owners.map((n) => `· wa.me/${n}`).join("\n")
        : "· sin configurar todavía";
      return reply(`🍅 *Creador*\n\n${duenos}`);
    }
  },
  {
    name: "username",
    aliases: ["nick"],
    category: "info",
    desc: "Muestra tu nombre de WhatsApp y tu identificador.",
    run: async ({ reply, msg }) => {
      return reply(
        `🍅 *Tu identidad aquí*\n\n` +
          `· Nombre: *${msg.pushName || "sin nombre"}*\n` +
          `· Número: *${msg.numero}*`
      );
    }
  },
  {
    name: "cmds",
    aliases: ["total"],
    category: "info",
    desc: "Cuántos comandos hay y cómo se reparten.",
    run: async ({ reply, lista }) => {
      const cuenta = new Map();
      for (const comando of lista) cuenta.set(comando.category, (cuenta.get(comando.category) || 0) + 1);
      const filas = [...cuenta.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([categoria, cuantos]) => `· ${categoria}: *${cuantos}*`)
        .join("\n");
      return reply(`🍅 *${numero(lista.length)} comandos*\n\n${filas}`);
    }
  },
  {
    name: "boton",
    category: "info",
    desc: "Comprueba si el bot puede responder botones en este chat.",
    run: async ({ reply }) => {
      return reply(
        "🍅 Los botones nativos dependen de la versión de WhatsApp del teléfono.\n" +
          "Si no los ves, usa los comandos de texto: el bot responde igual."
      );
    }
  },
  {
    name: "checkchannel",
    aliases: ["canal"],
    category: "info",
    desc: "Muestra el canal del bot, si está configurado.",
    run: async ({ reply }) => {
      if (!config.enlaces.canal) return reply("🍅 Este bot no tiene canal configurado (`CHANNEL` en el `.env`).");
      return reply(`🍅 *Canal oficial*\n${config.enlaces.canal}`);
    }
  },
  {
    name: "clima",
    aliases: ["tiempo", "weather"],
    category: "info",
    desc: "Clima actual de una ciudad.",
    usage: "<ciudad>",
    run: async ({ reply, text }) => {
      const ciudad = text.trim() || "Ciudad de Mexico";
      try {
        const geo = await pedirJson(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ciudad)}&count=1&language=es`
        );
        const sitio = geo?.results?.[0];
        if (!sitio) return reply(`🍅 No encontré «${ciudad}». Prueba con otra ciudad.`);

        const clima = await pedirJson(
          `https://api.open-meteo.com/v1/forecast?latitude=${sitio.latitude}&longitude=${sitio.longitude}` +
            `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`
        );
        const actual = clima?.current;
        if (!actual) return reply("🍅 El servicio del clima no devolvió datos.");

        const codigos = {
          0: "despejado ☀️", 1: "casi despejado 🌤️", 2: "parcialmente nublado ⛅",
          3: "nublado ☁️", 45: "niebla 🌫️", 48: "niebla helada 🌫️",
          51: "llovizna 🌦️", 61: "lluvia 🌧️", 63: "lluvia moderada 🌧️",
          65: "lluvia fuerte ⛈️", 71: "nieve 🌨️", 80: "chubascos 🌦️",
          95: "tormenta ⛈️", 96: "tormenta con granizo ⛈️"
        };

        return reply(
          `🍅 *Clima en ${sitio.name}${sitio.country ? ", " + sitio.country : ""}*\n\n` +
            `· Estado: *${codigos[actual.weather_code] || "sin dato"}*\n` +
            `· Temperatura: *${actual.temperature_2m} °C*\n` +
            `· Humedad: *${actual.relative_humidity_2m}%*\n` +
            `· Viento: *${actual.wind_speed_10m} km/h*\n` +
            `· Actualizado: ${hora()}`
        );
      } catch (error) {
        return reply(`🍅 No pude consultar el clima: ${recortar(error.message, 120)}`);
      }
    }
  },
  {
    name: "id",
    category: "info",
    desc: "Tu JID y el del chat, útiles para configuración.",
    run: async ({ reply, msg }) => {
      return reply(
        `🍅 *Identificadores*\n\n` +
          `· Tú: \`${msg.sender}\`\n` +
          `· Chat: \`${msg.chat}\`\n` +
          `· Grupo: *${msg.isGroup ? "sí" : "no"}*\n` +
          `· Fecha: ${fecha()}`
      );
    }
  }
];
