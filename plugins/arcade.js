/**
 * Tomate ofc bot — arcade de texto.
 *
 * Estos cinco juegos se dibujan con emojis dentro del mensaje, porque el bot
 * no manda imágenes cuadro a cuadro. Se juega escribiendo el movimiento:
 *
 *   .snake            → abre la partida
 *   .snake arriba     → mueve la serpiente
 *
 * Cada partida vive en memoria y es de quien la abrió: si otra persona escribe
 * en el mismo chat, el bot le dice que esa partida no es suya.
 */

import { azar, elegir, nombreCorto } from "../src/utils.js";

/** Salas por chat (una por juego y chat). */
const salas = new Map();

const salaDe = (chat, juego, creador) => {
  const salas_ = salas.get(chat) || {};
  salas.set(chat, salas_);
  if (!salas_[juego]) salas_[juego] = { de: creador, inicio: Date.now() };
  return salas_[juego];
};

const terminar = (chat, juego) => {
  const salas_ = salas.get(chat);
  if (salas_) delete salas_[juego];
};

const DIRECCIONES = {
  arriba: [-1, 0], w: [-1, 0], up: [-1, 0],
  abajo: [1, 0], s: [1, 0], down: [1, 0],
  izquierda: [0, -1], a: [0, -1], izq: [0, -1], left: [0, -1],
  derecha: [0, 1], d: [0, 1], der: [0, 1], right: [0, 1]
};

/* ───────────────────────────── Serpiente ───────────────────────────── */

const ANCHO = 7;
const ALTO = 7;

/** Dibuja el tablero de la serpiente. */
function dibujarSerpiente(juego) {
  const filas = [];
  for (let y = 0; y < ALTO; y++) {
    let fila = "";
    for (let x = 0; x < ANCHO; x++) {
      const esCabeza = juego.cuerpo[0][0] === y && juego.cuerpo[0][1] === x;
      const esCuerpo = juego.cuerpo.some(([cy, cx]) => cy === y && cx === x);
      if (esCabeza) fila += "🟩";
      else if (esCuerpo) fila += "🟢";
      else if (juego.comida[0] === y && juego.comida[1] === x) fila += "🍅";
      else fila += "⬛";
    }
    filas.push(fila);
  }
  return filas.join("\n");
}

/** Pone la comida en una casilla libre. */
function nuevaComida(juego) {
  for (let intento = 0; intento < 200; intento++) {
    const y = azar(0, ALTO - 1);
    const x = azar(0, ANCHO - 1);
    if (!juego.cuerpo.some(([cy, cx]) => cy === y && cx === x)) return [y, x];
  }
  return [0, 0];
}

/* ─────────────────────────────── Pong ─────────────────────────────── */

/** Zonas de la paleta. */
const ZONAS = ["izquierda", "centro", "derecha"];

/** Dibuja la cancha según dónde viene la pelota. */
function dibujarPong(juego) {
  const columnas = 5;
  const linea = Array(columnas).fill("⬛");
  const color = juego.pelota === 1 ? "🟡" : "🟠";
  linea[[0, 2, 4][juego.pelota]] = color;
  return (
    `🏓 *Pong* — tú ${juego.tuyos} · bot ${juego.suyos}\n\n` +
    `   ${linea.join("")}\n   ⬛⬛⬛⬛⬛\n   ${["🟦", "🟦", "🟦", "🟦", "🟦"].join("")}`
  );
}

/** Una jugada del bot: devuelve la zona donde pega. */
const zonaBot = () => elegir(ZONAS);

/* ────────────────────────────── Flappy ────────────────────────────── */

const ALTO_VUELO = 7;

/** Dibuja el pájaro y los tubos. */
function dibujarFlappy(juego) {
  const filas = [];
  for (let y = 0; y < ALTO_VUELO; y++) {
    let fila = "";
    if (y === juego.pajaro) fila += "🐤";
    else if (juego.pajaro < y) fila += "⬜";
    else fila += "⬛";
    // Hueco del tubo entre juego.hueco y juego.hueco + 2
    const dentroDelHueco = y >= juego.hueco && y <= juego.hueco + 2;
    fila += dentroDelHueco ? "⬛" : "🟩";
    filas.push(fila);
  }
  return `🐤 *Flappy* — puntos: ${juego.puntos}\n\n${filas.join("\n")}\n\nEscribe *.flappy saltar*`;
}

/* ────────────────────────────── Pac-Man ───────────────────────────── */

const LABERINTO = [
  "#########",
  "#.......#",
  "#.##.##.#",
  "#.......#",
  "#.##.##.#",
  "#.......#",
  "#########"
];

/** Puntos que quedan por comer. */
const contarPuntos = (mapa) => mapa.flat().filter((c) => c === ".").length;

/** Dibuja el laberinto. */
function dibujarPacman(juego) {
  return juego.mapa
    .map((fila, y) =>
      fila
        .map((casilla, x) => {
          if (juego.jugador[0] === y && juego.jugador[1] === x) return "🟡";
          if (juego.fantasma[0] === y && juego.fantasma[1] === x) return "👻";
          if (casilla === "#") return "🧱";
          if (casilla === ".") return "⚪";
          return "⬛";
        })
        .join("")
    )
    .join("\n");
}

/** Movimiento del fantasma: una casilla libre al azar. */
function moverFantasma(juego) {
  const [y, x] = juego.fantasma;
  const opciones = [];
  for (const [dy, dx] of Object.values(DIRECCIONES)) {
    const ny = y + dy;
    const nx = x + dx;
    if (juego.mapa[ny]?.[nx] && juego.mapa[ny][nx] !== "#") opciones.push([ny, nx]);
  }
  if (opciones.length) juego.fantasma = elegir(opciones);
}

/* ────────────────────────────── Tetris ────────────────────────────── */

const ANCHO_T = 8;
const ALTO_T = 12;

/** Piezas base: cada una es una matriz. */
const PIEZAS = {
  O: [[1, 1], [1, 1]],
  I: [[1, 1, 1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  L: [[1, 0], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0]]
};

/** Gira una matriz de pieza. */
const girar = (matriz) => matriz[0].map((_, i) => matriz.map((fila) => fila[i]).reverse());

/** Dibuja el tablero de tetris con la pieza activa encima. */
function dibujarTetris(juego) {
  const tablero = juego.tablero.map((fila) => [...fila]);
  juego.pieza.forEach((fila, y) =>
    fila.forEach((valor, x) => {
      if (!valor) return;
      const ty = juego.piezaY + y;
      const tx = juego.piezaX + x;
      if (tablero[ty]?.[tx] !== undefined) tablero[ty][tx] = 1;
    })
  );
  return tablero
    .map((fila) => fila.map((v) => (v ? "🟪" : "⬛")).join(""))
    .join("\n");
}

/** ¿Cabe la pieza en esa posición? */
function cabe(juego, pieza = juego.pieza, x = juego.piezaX, y = juego.piezaY) {
  return pieza.every((fila, dy) =>
    fila.every((valor, dx) => {
      if (!valor) return true;
      const ty = y + dy;
      const tx = x + dx;
      if (tx < 0 || tx >= ANCHO_T || ty >= ALTO_T) return false;
      if (ty < 0) return true;
      return juego.tablero[ty][tx] === 0;
    })
  );
}

/** Fija la pieza al tablero y saca una nueva. Devuelve las líneas hechas. */
function fijarPieza(juego) {
  juego.pieza.forEach((fila, dy) =>
    fila.forEach((valor, dx) => {
      if (!valor) return;
      const ty = juego.piezaY + dy;
      const tx = juego.piezaX + dx;
      if (ty >= 0) juego.tablero[ty][tx] = 1;
    })
  );
  const quedan = juego.tablero.filter((fila) => fila.some((v) => !v));
  const lineas = ALTO_T - quedan.length;
  juego.tablero = [
    ...Array.from({ length: lineas }, () => Array(ANCHO_T).fill(0)),
    ...quedan
  ];
  juego.lineas += lineas;
  nuevaPieza(juego);
  return lineas;
}

/** Saca una pieza nueva arriba. */
function nuevaPieza(juego) {
  const nombre = elegir(Object.keys(PIEZAS));
  juego.pieza = PIEZAS[nombre].map((fila) => [...fila]);
  juego.nombre = nombre;
  juego.piezaX = Math.floor((ANCHO_T - juego.pieza[0].length) / 2);
  juego.piezaY = 0;
  return cabe(juego);
}

/** Baja la pieza una casilla; si no cabe, la fija. */
function bajarTetris(juego) {
  if (cabe(juego, juego.pieza, juego.piezaX, juego.piezaY + 1)) {
    juego.piezaY += 1;
    return { fijo: false, lineas: 0 };
  }
  const lineas = fijarPieza(juego);
  return { fijo: true, lineas };
}

export default [
  {
    name: "snake",
    aliases: ["serpiente"],
    category: "minijuegos",
    desc: "Serpiente de texto: come tomates y no te muerdas la cola.",
    usage: "[arriba|abajo|izquierda|derecha]",
    run: async ({ reply, chat, args, msg, store }) => {
      const direccion = (args[0] || "").toLowerCase();
      const existente = salas.get(chat)?.snake;

      if (!existente || !direccion) {
        const juego = salaDe(chat, "snake", msg.sender);
        juego.cuerpo = [[3, 3]];
        juego.viva = true;
        juego.puntos = 0;
        juego.ultima = "derecha";
        juego.comida = nuevaComida(juego);
        return reply(
          `🐍 *Serpiente*\n\n${dibujarSerpiente(juego)}\n\n` +
            "Mueve con *.snake arriba|abajo|izquierda|derecha*"
        );
      }

      const juego = existente;
      if (juego.de !== msg.sender) return reply("🍅 Esa partida es de otra persona.");
      const delta = DIRECCIONES[direccion];
      if (!delta) return reply("🍅 Direcciones: arriba, abajo, izquierda, derecha.");
      if (!juego.viva) return reply("🍅 Esa partida ya terminó. Abre otra con *.snake*");

      const [dy, dx] = delta;
      const [cy, cx] = juego.cuerpo[0];
      const nuevo = [cy + dy, cx + dx];

      if (nuevo[0] < 0 || nuevo[0] >= ALTO || nuevo[1] < 0 || nuevo[1] >= ANCHO) {
        const puntos = juego.puntos;
        terminar(chat, "snake");
        return reply(`🐍 Te saliste del tablero. Puntos: *${puntos}*`);
      }
      if (juego.cuerpo.some(([y, x]) => y === nuevo[0] && x === nuevo[1])) {
        const puntos = juego.puntos;
        terminar(chat, "snake");
        return reply(`🐍 Te mordiste. Puntos: *${puntos}*`);
      }

      juego.cuerpo.unshift(nuevo);
      if (nuevo[0] === juego.comida[0] && nuevo[1] === juego.comida[1]) {
        juego.puntos += 1;
        juego.comida = nuevaComida(juego);
        store.sumarCoins(msg.sender, 25);
      } else {
        juego.cuerpo.pop();
      }

      return reply(`🐍 *Serpiente* — ${juego.puntos} 🍅\n\n${dibujarSerpiente(juego)}`);
    }
  },
  {
    name: "pong",
    aliases: ["tenis"],
    category: "minijuegos",
    desc: "Pong de texto: devuelve la pelota al bot.",
    usage: "[izquierda|centro|derecha]",
    run: async ({ reply, chat, args, msg, store }) => {
      const zona = (args[0] || "").toLowerCase();
      const existente = salas.get(chat)?.pong;

      if (!existente || !zona) {
        const juego = salaDe(chat, "pong", msg.sender);
        juego.tuyos = 0;
        juego.suyos = 0;
        juego.pelota = azar(0, 2);
        return reply(`${dibujarPong(juego)}\n\nDevuelve con *.pong izquierda|centro|derecha*`);
      }

      const juego = existente;
      if (juego.de !== msg.sender) return reply("🍅 Esa partida es de otra persona.");
      if (!ZONAS.includes(zona)) return reply("🍅 Usa: izquierda, centro o derecha.");

      const objetivo = zonaBot();
      const acierta = zona === objetivo || azar(1, 100) <= 25;
      if (acierta) juego.tuyos += 1;
      else juego.suyos += 1;
      juego.pelota = azar(0, 2);

      if (juego.tuyos >= 5 || juego.suyos >= 5) {
        const gano = juego.tuyos >= 5;
        terminar(chat, "pong");
        if (gano) store.sumarCoins(msg.sender, 400);
        return reply(
          `🏓 *Fin* — tú ${juego.tuyos} · bot ${juego.suyos}\n\n` +
            (gano ? "Ganaste *400 🍅*" : "Perdiste la partida.")
        );
      }

      return reply(`🏓 Cayó a la *${objetivo}*.\n\n${dibujarPong(juego)}`);
    }
  },
  {
    name: "flappy",
    aliases: ["pajaro"],
    category: "minijuegos",
    desc: "Pasa entre los tubos saltando.",
    usage: "[saltar]",
    run: async ({ reply, chat, args, msg, store }) => {
      const accion = (args[0] || "").toLowerCase();
      const existente = salas.get(chat)?.flappy;

      if (!existente || !accion) {
        const juego = salaDe(chat, "flappy", msg.sender);
        juego.pajaro = 3;
        juego.hueco = azar(0, ALTO_VUELO - 3);
        juego.puntos = 0;
        juego.tuboX = 4;
        return reply(dibujarFlappy(juego));
      }

      const juego = existente;
      if (juego.de !== msg.sender) return reply("🍅 Esa partida es de otra persona.");

      // El salto sube tres casillas y la gravedad baja dos: así se corrige.
      juego.pajaro = Math.max(0, juego.pajaro - 3);
      juego.pajaro = Math.min(ALTO_VUELO - 1, juego.pajaro + 2);
      juego.tuboX -= 1;

      if (juego.tuboX <= 0) {
        const dentro = juego.pajaro >= juego.hueco && juego.pajaro <= juego.hueco + 2;
        if (!dentro) {
          const puntos = juego.puntos;
          terminar(chat, "flappy");
          return reply(`🐤 Te pegaste al tubo. Puntos: *${puntos}*`);
        }
        juego.puntos += 1;
        store.sumarCoins(msg.sender, 30);
        juego.hueco = azar(0, ALTO_VUELO - 3);
        juego.tuboX = 4;
      }

      return reply(dibujarFlappy(juego));
    }
  },
  {
    name: "pacman",
    aliases: ["comecocos"],
    category: "minijuegos",
    desc: "Cómete todos los puntos sin que te atrape el fantasma.",
    usage: "[arriba|abajo|izquierda|derecha]",
    run: async ({ reply, chat, args, msg, store }) => {
      const direccion = (args[0] || "").toLowerCase();
      const existente = salas.get(chat)?.pacman;

      if (!existente || !direccion) {
        const juego = salaDe(chat, "pacman", msg.sender);
        juego.mapa = LABERINTO.map((fila) => fila.split(""));
        juego.jugador = [1, 1];
        juego.mapa[1][1] = " ";
        juego.fantasma = [5, 7];
        juego.mapa[5][7] = " ";
        juego.puntos = 0;
        return reply(`${dibujarPacman(juego)}\n\nMueve con *.pacman arriba|abajo|izquierda|derecha*`);
      }

      const juego = existente;
      if (juego.de !== msg.sender) return reply("🍅 Esa partida es de otra persona.");
      const delta = DIRECCIONES[direccion];
      if (!delta) return reply("🍅 Direcciones: arriba, abajo, izquierda, derecha.");

      const ny = juego.jugador[0] + delta[0];
      const nx = juego.jugador[1] + delta[1];
      const casilla = juego.mapa[ny]?.[nx];
      if (casilla === undefined || casilla === "#") {
        return reply("🧱 Pared. Prueba otra dirección.");
      }

      if (casilla === ".") {
        juego.puntos += 1;
        juego.mapa[ny][nx] = " ";
        store.sumarCoins(msg.sender, 10);
      }
      juego.jugador = [ny, nx];
      moverFantasma(juego);

      if (juego.fantasma[0] === ny && juego.fantasma[1] === nx) {
        const puntos = juego.puntos;
        terminar(chat, "pacman");
        return reply(`👻 Te atrapó. Puntos: *${puntos}*`);
      }
      if (contarPuntos(juego.mapa) === 0) {
        terminar(chat, "pacman");
        store.sumarCoins(msg.sender, 600);
        return reply(`🟡 ¡Tablero limpio! Puntos: *${juego.puntos}* · premio *600 🍅*`);
      }

      return reply(`${dibujarPacman(juego)}\n\nPuntos: *${juego.puntos}*`);
    }
  },
  {
    name: "tetris",
    aliases: ["bloques"],
    category: "minijuegos",
    desc: "Tetris de texto: acomoda las piezas y haz líneas.",
    usage: "[izquierda|derecha|rotar|bajar]",
    run: async ({ reply, chat, args, msg, store }) => {
      const accion = (args[0] || "").toLowerCase();
      const existente = salas.get(chat)?.tetris;

      if (!existente || !accion) {
        const juego = salaDe(chat, "tetris", msg.sender);
        juego.tablero = Array.from({ length: ALTO_T }, () => Array(ANCHO_T).fill(0));
        juego.lineas = 0;
        juego.puntos = 0;
        nuevaPieza(juego);
        return reply(
          `🟪 *Tetris*\n\n${dibujarTetris(juego)}\n\n` +
            "Mueve con *.tetris izquierda|derecha|rotar|bajar* (cada *bajar* fija la pieza al fondo)"
        );
      }

      const juego = existente;
      if (juego.de !== msg.sender) return reply("🍅 Esa partida es de otra persona.");

      if (accion === "izquierda" || accion === "izq") {
        if (cabe(juego, juego.pieza, juego.piezaX - 1, juego.piezaY)) juego.piezaX -= 1;
      } else if (accion === "derecha" || accion === "der") {
        if (cabe(juego, juego.pieza, juego.piezaX + 1, juego.piezaY)) juego.piezaX += 1;
      } else if (accion === "rotar" || accion === "girar") {
        const girada = girar(juego.pieza);
        if (cabe(juego, girada)) juego.pieza = girada;
      } else if (accion === "bajar" || accion === "abajo") {
        while (cabe(juego, juego.pieza, juego.piezaX, juego.piezaY + 1)) juego.piezaY += 1;
        const resultado = bajarTetris(juego);
        juego.puntos += resultado.lineas * 100;
        if (resultado.lineas) store.sumarCoins(msg.sender, resultado.lineas * 150);
        if (!cabe(juego)) {
          const puntos = juego.puntos;
          const lineas = juego.lineas;
          terminar(chat, "tetris");
          return reply(`🟪 Fin del juego. Líneas: *${lineas}* · Puntos: *${puntos}*`);
        }
      } else {
        return reply("🍅 Usa: izquierda, derecha, rotar o bajar.");
      }

      return reply(
        `🟪 *Tetris* — líneas: ${juego.lineas} · puntos: ${juego.puntos}\n\n${dibujarTetris(juego)}`
      );
    }
  },
  {
    name: "salirarcade",
    aliases: ["cerrarjuego"],
    category: "minijuegos",
    desc: "Cierra tu partida abierta en este chat.",
    run: async ({ reply, chat, msg }) => {
      const salas_ = salas.get(chat) || {};
      const abiertas = Object.keys(salas_).filter((juego) => salas_[juego]?.de === msg.sender);
      if (!abiertas.length) return reply("🍅 No tienes partidas abiertas.");
      for (const juego of abiertas) delete salas_[juego];
      return reply(`🍅 Cerraste: *${abiertas.join(", ")}* (${nombreCorto(msg.sender)})`);
    }
  }
];
