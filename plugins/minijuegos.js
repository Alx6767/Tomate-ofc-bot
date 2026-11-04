/**
 * Tomate ofc bot — minijuegos por chat.
 *
 * Cada juego guarda su partida en memoria y en su propio espacio: dos grupos
 * pueden jugar a la vez sin pisarse. Los que necesitan dibujar (snake, tetris,
 * flappy, pacman, pong) NO están: exigirían generar imágenes cuadro a cuadro y
 * no se van a fingir con texto que no se parece a un juego.
 */

import { azar, elegir, nombreCorto, recortar } from "../src/utils.js";

/** Salas por chat. */
const salas = new Map();

/** Baraja española resumida para el 21. */
const CARTAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10];

/** Valor de una mano, con el as valiendo 11 si no se pasa. */
function valorMano(mano) {
  let total = mano.reduce((suma, c) => suma + c, 0);
  let ases = mano.filter((c) => c === 1).length;
  while (total + 10 <= 21 && ases > 0) {
    total += 10;
    ases -= 1;
  }
  return total;
}

const mostrarMano = (mano) => mano.map((c) => (c === 1 ? "A" : c)).join(" ");

/** Tablero de buscaminas en texto. */
function tableroTexto(tablero, visible) {
  const filas = [];
  for (let y = 0; y < tablero.length; y++) {
    let fila = "";
    for (let x = 0; x < tablero[y].length; x++) {
      fila += visible[y][x] ? (tablero[y][x] === -1 ? "💥" : tablero[y][x] === 0 ? "▫️" : String(tablero[y][x])) : "⬛";
    }
    filas.push(fila);
  }
  return filas.join("\n");
}

export default [
  {
    name: "sala21",
    aliases: ["blackjack", "21"],
    category: "minijuegos",
    desc: "Blackjack contra el bot. Pide carta o plantarte.",
    usage: "[pedir|plantarse]",
    run: async ({ reply, chat, args, store, msg }) => {
      const accion = (args[0] || "").toLowerCase();
      const sala = salas.get(chat);

      if (!sala || !sala.veintiuno || accion === "nuevo") {
        const jugador = [elegir(CARTAS), elegir(CARTAS)];
        const banca = [elegir(CARTAS), elegir(CARTAS)];
        salas.set(chat, { ...(sala || {}), veintiuno: { jugador, banca, de: msg.sender } });
        return reply(
          `🍅 *21*\n\n· Tú: *${mostrarMano(jugador)}* (${valorMano(jugador)})\n· Banca: *${banca[0]} ?*\n\n` +
            "Pide con *.sala21 pedir* o plántate con *.sala21 plantarse*"
        );
      }

      const juego = sala.veintiuno;
      if (juego.de !== msg.sender) return reply("🍅 Esta partida es de otra persona.");

      if (accion === "pedir") {
        juego.jugador.push(elegir(CARTAS));
        const total = valorMano(juego.jugador);
        if (total > 21) {
          salas.delete(chat);
          return reply(`🍅 *${mostrarMano(juego.jugador)}* = *${total}*. Te pasaste. 😬`);
        }
        return reply(`🍅 *${mostrarMano(juego.jugador)}* = *${total}*`);
      }

      if (accion === "plantarse") {
        let totalBanca = valorMano(juego.banca);
        while (totalBanca < 17) {
          juego.banca.push(elegir(CARTAS));
          totalBanca = valorMano(juego.banca);
        }
        const totalJugador = valorMano(juego.jugador);
        salas.delete(chat);
        const gano = totalBanca > 21 || totalJugador > totalBanca;
        if (gano) store.sumarCoins(msg.sender, 300);
        return reply(
          `🍅 *Fin de la mano*\n\n· Tú: ${mostrarMano(juego.jugador)} = *${totalJugador}*\n` +
            `· Banca: ${mostrarMano(juego.banca)} = *${totalBanca}*\n\n` +
            (gano ? "Ganaste *300 🍅*" : "Perdiste la mano.")
        );
      }

      return reply("🍅 Usa *.sala21 pedir* o *.sala21 plantarse*");
    }
  },
  {
    name: "buscaminas",
    category: "minijuegos",
    desc: "Buscaminas 5×5 en texto. Escribe la casilla (fila,columna).",
    usage: "[fila,columna]",
    run: async ({ reply, chat, args, store, msg }) => {
      const jugada = (args[0] || "").split(",").map((n) => Number(n));
      const sala = salas.get(chat);

      if (!sala?.buscaminas) {
        const tablero = Array.from({ length: 5 }, () => Array(5).fill(0));
        let minas = 0;
        while (minas < 5) {
          const y = azar(0, 4);
          const x = azar(0, 4);
          if (tablero[y][x] === -1) continue;
          tablero[y][x] = -1;
          minas++;
        }
        for (let y = 0; y < 5; y++) {
          for (let x = 0; x < 5; x++) {
            if (tablero[y][x] === -1) continue;
            let cuenta = 0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (tablero[y + dy]?.[x + dx] === -1) cuenta++;
              }
            }
            tablero[y][x] = cuenta;
          }
        }
        const visible = Array.from({ length: 5 }, () => Array(5).fill(false));
        salas.set(chat, { ...(sala || {}), buscaminas: { tablero, visible, de: msg.sender, abiertas: 0 } });
        return reply(
          `🍅 *Buscaminas*\n\n${tableroTexto(tablero, visible)}\n\nAbre una casilla con *.buscaminas 2,3*`
        );
      }

      const juego = sala.buscaminas;
      if (juego.de !== msg.sender) return reply("🍅 Esta partida es de otra persona.");
      if (jugada.length !== 2 || jugada.some((n) => !Number.isInteger(n) || n < 1 || n > 5)) {
        return reply("🍅 Escribe fila,columna del 1 al 5. Ejemplo: *.buscaminas 2,3*");
      }

      const y = jugada[0] - 1;
      const x = jugada[1] - 1;
      if (juego.visible[y][x]) return reply("🍅 Esa casilla ya está abierta.");

      juego.visible[y][x] = true;
      if (juego.tablero[y][x] === -1) {
        salas.delete(chat);
        for (const fila of juego.visible) fila.fill(true);
        return reply(`🍅 💥 Mina.\n\n${tableroTexto(juego.tablero, juego.visible)}`);
      }

      juego.abiertas += 1;
      if (juego.abiertas >= 20) {
        salas.delete(chat);
        store.sumarCoins(msg.sender, 500);
        return reply("🍅 ¡Ganaste! Despejaste todo el tablero. *+500 🍅*");
      }
      return reply(`🍅 ${tableroTexto(juego.tablero, juego.visible)}\n\nAbiertas: *${juego.abiertas}/20*`);
    }
  },
  {
    name: "bunker",
    aliases: ["refugio"],
    category: "minijuegos",
    desc: "Abre un búnker para el grupo y reparte roles.",
    group: true,
    run: async ({ reply, chat, msg }) => {
      const roles = [
        "médico", "ingeniero", "cocinero", "guardia", "agricultor",
        "maestro", "mecánico", "electricista", "cazador", "químico"
      ];
      const reparto = roles.slice(0, 4).map((rol) => ({ rol, de: msg.sender }));
      salas.set(chat, { ...(salas.get(chat) || {}), bunker: { roles: reparto, creado: Date.now() } });
      const lista = reparto.map((r, i) => `· ${i + 1}. ${r.rol}`).join("\n");
      return reply(
        `🍅 *Búnker abierto*\n\nHay 4 lugares. Roles disponibles:\n${lista}\n\n` +
          "Únete con *.joinpartida <número>* y el grupo vota con *.bunkervoto <número>*"
      );
    }
  },
  {
    name: "joinpartida",
    aliases: ["entrar"],
    category: "minijuegos",
    desc: "Entra a la partida de búnker con un rol.",
    usage: "<número de rol>",
    group: true,
    run: async ({ reply, chat, msg, args }) => {
      const partida = salas.get(chat)?.bunker;
      if (!partida) return reply("🍅 No hay partida abierta. Abre una con *.bunker*");
      const indice = Number(args[0]) - 1;
      const puesto = partida.roles[indice];
      if (!puesto) return reply("🍅 Ese rol no existe.");
      if (puesto.de && puesto.de !== msg.sender) return reply("🍅 Ese rol ya está tomado.");
      puesto.de = msg.sender;
      return reply(`🍅 *${nombreCorto(msg.sender)}* entra como *${puesto.rol}*.`);
    }
  },
  {
    name: "bunkervoto",
    aliases: ["votarbunker"],
    category: "minijuegos",
    desc: "Vota para sacar a alguien del búnker.",
    usage: "<número de rol>",
    group: true,
    run: async ({ reply, chat, args }) => {
      const partida = salas.get(chat)?.bunker;
      if (!partida) return reply("🍅 No hay partida abierta.");
      const indice = Number(args[0]) - 1;
      const puesto = partida.roles[indice];
      if (!puesto?.de) return reply("🍅 Ese lugar está vacío.");
      partida.roles.splice(indice, 1);
      return reply(`🍅 El grupo expulsó a *${nombreCorto(puesto.de)}* del búnker.`);
    }
  },
  {
    name: "carreracrear",
    aliases: ["carrera"],
    category: "minijuegos",
    desc: "Abre una carrera de tomates para el grupo.",
    group: true,
    run: async ({ reply, chat }) => {
      salas.set(chat, { ...(salas.get(chat) || {}), carrera: { corredores: [], abierta: true } });
      return reply(
        "🍅 *Carrera abierta*\n\nÚnete con *.joincarrera* y arranca con *.iniciarb*"
      );
    }
  },
  {
    name: "joincarrera",
    aliases: ["correr2"],
    category: "minijuegos",
    desc: "Apúntate a la carrera abierta.",
    group: true,
    run: async ({ reply, chat, msg }) => {
      const carrera = salas.get(chat)?.carrera;
      if (!carrera?.abierta) return reply("🍅 No hay carrera abierta.");
      if (carrera.corredores.includes(msg.sender)) return reply("🍅 Ya estás dentro.");
      carrera.corredores.push(msg.sender);
      return reply(`🍅 *${nombreCorto(msg.sender)}* se apuntó. Van *${carrera.corredores.length}*.`);
    }
  },
  {
    name: "iniciarb",
    aliases: ["iniciarcarrera"],
    category: "minijuegos",
    desc: "Arranca la carrera y corre.",
    group: true,
    run: async ({ reply, chat, store }) => {
      const carrera = salas.get(chat)?.carrera;
      if (!carrera?.abierta) return reply("🍅 No hay carrera abierta.");
      if (carrera.corredores.length < 2) return reply("🍅 Hace falta al menos dos corredores.");
      carrera.abierta = false;
      const pista = carrera.corredores.map((jid) => ({ jid, avance: 0 }));
      for (let vuelta = 0; vuelta < 5; vuelta++) {
        for (const corredor of pista) corredor.avance += azar(0, 4);
      }
      const ganador = [...pista].sort((a, b) => b.avance - a.avance)[0];
      store.sumarCoins(ganador.jid, 700);
      salas.delete(chat);
      const tabla = pista
        .sort((a, b) => b.avance - a.avance)
        .map((c, i) => `${i + 1}. ${nombreCorto(c.jid)} — ${c.avance}/20`)
        .join("\n");
      return reply(`🍅 *Carrera terminada*\n\n${tabla}\n\nGanó *${nombreCorto(ganador.jid)}*: +700 🍅`);
    }
  },
  {
    name: "salirb",
    aliases: ["salircarrera"],
    category: "minijuegos",
    desc: "Sálte de la carrera o del búnker.",
    group: true,
    run: async ({ reply, chat, msg }) => {
      const sala = salas.get(chat);
      if (!sala) return reply("🍅 No hay nada abierto.");
      if (sala.carrera) {
        sala.carrera.corredores = sala.carrera.corredores.filter((j) => j !== msg.sender);
      }
      if (sala.bunker) {
        const puesto = sala.bunker.roles.find((r) => r.de === msg.sender);
        if (puesto) puesto.de = null;
      }
      return reply("🍅 Saliste.");
    }
  }
];
