/**
 * Tomate ofc bot — economía y RPG.
 *
 * El dinero del bot es ficticio (🍅) y no vale nada fuera del juego. Todas las
 * acciones que dan dinero tienen enfriamiento; el enfriamiento vive en el
 * propio usuario (una marca de tiempo), así que sobrevive a un reinicio.
 */

import { azar, aCantidad, duracion, elegir, monedas, nombreCorto, numero, partir, recortar } from "../src/utils.js";

/** Esperas, en milisegundos. */
const ESPERA = {
  daily: 24 * 3600_000,
  work: 3600_000,
  crimen: 2 * 3600_000,
  robar: 30 * 60_000,
  cofre: 6 * 3600_000,
  accion: 8 * 60_000
};

/** Tienda: id → { nombre, precio, venta } */
const TIENDA = {
  pala: { nombre: "Pala", precio: 800, venta: 400 },
  caña: { nombre: "Caña de pescar", precio: 900, venta: 450 },
  hacha: { nombre: "Hacha", precio: 1000, venta: 500 },
  red: { nombre: "Red de caza", precio: 1200, venta: 600 },
  rifle: { nombre: "Rifle de caza", precio: 2500, venta: 1200 },
  escudo: { nombre: "Escudo de hojalata", precio: 1500, venta: 700 },
  espada: { nombre: "Espada de madera", precio: 2000, venta: 950 }
};

/** Recompensas por acción de campo. */
const ACCIONES = {
  minar: { nombre: "minaste", objeto: "mineral", premio: [120, 400], texto: "⛏️" },
  pescar: { nombre: "pescaste", objeto: "pescado", premio: [90, 320], texto: "🎣" },
  talar: { nombre: "talaste", objeto: "madera", premio: [100, 360], texto: "🪓" },
  cazar: { nombre: "cazaste", objeto: "carne", premio: [140, 420], texto: "🏹" },
  correr: { nombre: "corriste", objeto: "energía", premio: [60, 200], texto: "🏃" },
  granja: { nombre: "cosechaste", objeto: "tomate", premio: [80, 300], texto: "🍅" },
  cocinar: { nombre: "cocinaste", objeto: "platillo", premio: [150, 450], texto: "🍳" }
};

/** ¿Pasó el enfriamiento? Devuelve los ms que faltan (0 si ya se puede). */
function falta(usuario, clave, espera) {
  const ultimo = Number(usuario[`t_${clave}`] || 0);
  return Math.max(0, espera - (Date.now() - ultimo));
}

/** Mensaje estándar de espera. */
const enEspera = (ms, que) => `🍅 Todavía no. Podrás ${que} en *${duracion(ms)}*.`;

/** Añade un objeto al inventario del usuario. */
function darObjeto(usuario, objeto, cuantos = 1) {
  usuario.rpg.items[objeto] = (usuario.rpg.items[objeto] || 0) + cuantos;
}

/** Quien recibe una transferencia: el citado o el primer argumento. */
function destinatario(msg, args) {
  if (msg.quoted?.participant) return msg.quoted.participant;
  if (msg.mentionedJid?.[0]) return msg.mentionedJid[0];
  const digitos = String(args[0] || "").replace(/\D/g, "");
  return digitos ? `${digitos}@s.whatsapp.net` : null;
}

export default [
  {
    name: "bal",
    aliases: ["balance", "coins", "cartera"],
    category: "economia",
    desc: "Tu dinero: en la mano y en el banco.",
    run: async ({ reply, store, msg }) => {
      const usuario = store.usuario(msg.sender);
      return reply(
        `🍅 *Cartera de ${msg.pushName || msg.numero}*\n\n` +
          `· En mano: *${monedas(usuario.coins)}*\n` +
          `· En banco: *${monedas(usuario.banco)}*\n` +
          `· Total: *${monedas(usuario.coins + usuario.banco)}*`
      );
    }
  },
  {
    name: "baltop",
    aliases: ["top", "ranking"],
    category: "economia",
    desc: "Los más ricos del bot.",
    run: async ({ reply, store }) => {
      const filas = store.top("total", 10);
      if (!filas.length) return reply("🍅 Todavía nadie tiene tomates. Empieza con .daily");
      const texto = filas
        .map((fila, i) => `${i + 1}. ${nombreCorto(fila.jid)} — ${monedas(fila.valor)}`)
        .join("\n");
      return reply(`🍅 *Los más ricos*\n\n${texto}`);
    }
  },
  {
    name: "banco",
    aliases: ["bank"],
    category: "economia",
    desc: "Muestra lo que tienes guardado en el banco.",
    run: async ({ reply, store, msg }) => {
      const usuario = store.usuario(msg.sender);
      return reply(
        `🍅 *Banco*\n\n· Guardado: *${monedas(usuario.banco)}*\n· En mano: *${monedas(usuario.coins)}*`
      );
    }
  },
  {
    name: "depositar",
    aliases: ["dep"],
    category: "economia",
    desc: "Guarda dinero en el banco para que no te lo roben.",
    usage: "<cantidad|todo>",
    run: async ({ reply, store, msg, text }) => {
      const usuario = store.usuario(msg.sender);
      const cantidad = aCantidad(text, usuario.coins);
      if (cantidad === null || cantidad <= 0) return reply("🍅 Uso: .depositar 500 · .depositar todo");
      const metido = store.depositar(msg.sender, cantidad);
      return reply(`🍅 Guardaste *${monedas(metido)}*. En mano te quedan *${monedas(usuario.coins)}*.`);
    }
  },
  {
    name: "retirar",
    aliases: ["ret"],
    category: "economia",
    desc: "Saca dinero del banco.",
    usage: "<cantidad|todo>",
    run: async ({ reply, store, msg, text }) => {
      const usuario = store.usuario(msg.sender);
      const cantidad = aCantidad(text, usuario.banco);
      if (cantidad === null || cantidad <= 0) return reply("🍅 Uso: .retirar 500 · .retirar todo");
      const sacado = store.retirar(msg.sender, cantidad);
      return reply(`🍅 Sacaste *${monedas(sacado)}*.`);
    }
  },
  {
    name: "transferir",
    aliases: ["pagar"],
    category: "economia",
    desc: "Manda dinero a otra persona.",
    usage: "<@persona> <cantidad>",
    run: async ({ reply, store, msg, args }) => {
      const quien = destinatario(msg, args);
      const cantidad = aCantidad(args[1], store.usuario(msg.sender).coins);
      if (!quien) return reply("🍅 Di a quién: menciona, cita o escribe el número.");
      if (quien === msg.sender) return reply("🍅 No te puedes transferir a ti mismo.");
      if (cantidad === null || cantidad <= 0) return reply("🍅 Uso: .transferir @persona 500");
      const origen = store.usuario(msg.sender);
      if (origen.coins < cantidad) return reply("🍅 No tienes tanto en mano. Saca del banco primero.");
      store.sumarCoins(msg.sender, -cantidad);
      store.sumarCoins(quien, cantidad);
      return reply(`🍅 Le pasaste *${monedas(cantidad)}* a *${nombreCorto(quien)}*.`);
    }
  },
  {
    name: "daily",
    aliases: ["diario"],
    category: "economia",
    desc: "Tu recompensa diaria.",
    run: async ({ reply, store, msg }) => {
      const usuario = store.usuario(msg.sender);
      const espera = falta(usuario, "daily", ESPERA.daily);
      if (espera > 0) return reply(enEspera(espera, "reclamar"));
      const racha = usuario.racha ? usuario.racha + 1 : 1;
      const premio = 500 + Math.min(racha, 10) * 50 + azar(0, 200);
      usuario.t_daily = Date.now();
      usuario.racha = racha;
      store.sumarCoins(msg.sender, premio);
      return reply(`🍅 *Diario*\n\n· Ganaste: *${monedas(premio)}*\n· Racha: *${racha}* días`);
    }
  },
  {
    name: "work",
    aliases: ["trabajar", "chamba"],
    category: "economia",
    desc: "Trabaja una hora y cobra.",
    run: async ({ reply, store, msg }) => {
      const usuario = store.usuario(msg.sender);
      const espera = falta(usuario, "work", ESPERA.work);
      if (espera > 0) return reply(enEspera(espera, "volver a trabajar"));
      const oficio = elegir([
        "vendiste jitomates en la feria", "repartiste pedidos", "cargaste cajas en el mercado",
        "lavaste trastes en un puesto", "pintaste una barda", "cuidaste el huerto del vecino"
      ]);
      const pago = azar(150, 500);
      usuario.t_work = Date.now();
      store.sumarCoins(msg.sender, pago);
      return reply(`🍅 ${oficio} y cobraste *${monedas(pago)}*.`);
    }
  },
  {
    name: "crimen",
    category: "economia",
    desc: "Delito de mentira: gana mucho o paga la multa.",
    run: async ({ reply, store, msg }) => {
      const usuario = store.usuario(msg.sender);
      const espera = falta(usuario, "crimen", ESPERA.crimen);
      if (espera > 0) return reply(enEspera(espera, "volver a intentarlo"));
      usuario.t_crimen = Date.now();
      if (azar(1, 100) <= 55) {
        const botin = azar(400, 1200);
        store.sumarCoins(msg.sender, botin);
        return reply(`🍅 Te salió bien: *${monedas(botin)}*. Nadie sospecha nada.`);
      }
      const multa = Math.min(usuario.coins, azar(200, 700));
      store.sumarCoins(msg.sender, -multa);
      return reply(`🍅 Te atraparon. Multa: *${monedas(multa)}*.`);
    }
  },
  {
    name: "robar",
    aliases: ["steal"],
    category: "economia",
    desc: "Intenta robarle a alguien (el banco está a salvo).",
    usage: "<@persona>",
    run: async ({ reply, store, msg, args }) => {
      const quien = destinatario(msg, args);
      if (!quien || quien === msg.sender) return reply("🍅 Di a quién quieres robarle: menciónalo o cita un mensaje.");
      const usuario = store.usuario(msg.sender);
      const espera = falta(usuario, "robar", ESPERA.robar);
      if (espera > 0) return reply(enEspera(espera, "volver a robar"));
      const victima = store.usuario(quien);
      if (victima.coins < 50) return reply(`🍅 *${nombreCorto(quien)}* no lleva nada encima.`);
      usuario.t_robar = Date.now();
      if (azar(1, 100) <= 35) {
        const botin = Math.floor(victima.coins * (azar(10, 30) / 100));
        store.sumarCoins(quien, -botin);
        store.sumarCoins(msg.sender, botin);
        return reply(`🍅 Le robaste *${monedas(botin)}* a *${nombreCorto(quien)}*.`);
      }
      const perdida = Math.min(usuario.coins, azar(50, 250));
      store.sumarCoins(msg.sender, -perdida);
      return reply(`🍅 Te vieron. Perdiste *${monedas(perdida)}* huyendo.`);
    }
  },
  {
    name: "ruleta",
    category: "economia",
    desc: "Apuesta al rojo o al negro.",
    usage: "<cantidad> <rojo|negro>",
    run: async ({ reply, store, msg, args }) => {
      const usuario = store.usuario(msg.sender);
      const cantidad = aCantidad(args[0], usuario.coins);
      const color = (args[1] || "").toLowerCase();
      if (!cantidad || cantidad <= 0) return reply("🍅 Uso: .ruleta 200 rojo");
      if (!["rojo", "negro"].includes(color)) return reply("🍅 Elige *rojo* o *negro*.");
      if (usuario.coins < cantidad) return reply("🍅 No te alcanza.");
      const salio = azar(1, 36);
      const esRojo = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(salio);
      const gano = (esRojo && color === "rojo") || (!esRojo && color === "negro");
      if (gano) {
        store.sumarCoins(msg.sender, cantidad);
        return reply(`🍅 Cayó *${salio}* (${esRojo ? "rojo" : "negro"}). Ganaste *${monedas(cantidad)}*.`);
      }
      store.sumarCoins(msg.sender, -cantidad);
      return reply(`🍅 Cayó *${salio}* (${esRojo ? "rojo" : "negro"}). Perdiste *${monedas(cantidad)}*.`);
    }
  },
  {
    name: "slots",
    aliases: ["tragaperras"],
    category: "economia",
    desc: "Tragaperras de tres tambores.",
    usage: "<cantidad>",
    run: async ({ reply, store, msg, args }) => {
      const usuario = store.usuario(msg.sender);
      const cantidad = aCantidad(args[0], usuario.coins);
      if (!cantidad || cantidad <= 0) return reply("🍅 Uso: .slots 100");
      if (usuario.coins < cantidad) return reply("🍅 No te alcanza.");
      const simbolos = ["🍅", "🍒", "🔔", "💎", "🍋"];
      const tirada = [elegir(simbolos), elegir(simbolos), elegir(simbolos)];
      const iguales = tirada.filter((s) => s === tirada[0]).length;
      let premio = 0;
      if (iguales === 3) premio = cantidad * (tirada[0] === "💎" ? 10 : 5);
      else if (iguales === 2) premio = Math.floor(cantidad * 1.5);
      if (premio > 0) {
        store.sumarCoins(msg.sender, premio - cantidad);
        return reply(`${tirada.join(" ")}\n🍅 ¡Ganaste *${monedas(premio)}*!`);
      }
      store.sumarCoins(msg.sender, -cantidad);
      return reply(`${tirada.join(" ")}\n🍅 Nada. Perdiste *${monedas(cantidad)}*.`);
    }
  },
  {
    name: "cofre",
    aliases: ["chest"],
    category: "economia",
    desc: "Abre el cofre cada seis horas.",
    run: async ({ reply, store, msg }) => {
      const usuario = store.usuario(msg.sender);
      const espera = falta(usuario, "cofre", ESPERA.cofre);
      if (espera > 0) return reply(enEspera(espera, "abrir otro cofre"));
      usuario.t_cofre = Date.now();
      const hallazgo = elegir([
        { tipo: "coins", cantidad: azar(200, 900) },
        { tipo: "objeto", objeto: elegir(Object.keys(TIENDA)) },
        { tipo: "nada" },
        { tipo: "coins", cantidad: azar(1000, 2000) }
      ]);
      if (hallazgo.tipo === "coins") {
        store.sumarCoins(msg.sender, hallazgo.cantidad);
        return reply(`🍅 El cofre tenía *${monedas(hallazgo.cantidad)}*.`);
      }
      if (hallazgo.tipo === "objeto") {
        darObjeto(usuario, hallazgo.objeto);
        store.marcar();
        return reply(`🍅 El cofre tenía un objeto: *${TIENDA[hallazgo.objeto]?.nombre || hallazgo.objeto}*.`);
      }
      return reply("🍅 El cofre estaba vacío. Otra vez será.");
    }
  },
  {
    name: "nivel",
    aliases: ["xp", "lvl"],
    category: "economia",
    desc: "Tu nivel y lo que falta para el siguiente.",
    run: async ({ reply, store, msg }) => {
      const usuario = store.usuario(msg.sender);
      const necesaria = Math.max(100, usuario.nivel ** 2 * 100);
      const barra = "▰".repeat(Math.min(10, Math.round((usuario.xp / necesaria) * 10)));
      return reply(
        `🍅 *Nivel ${usuario.nivel}*\n\n${barra}${"▱".repeat(10 - barra.length)}\n` +
          `· XP: *${numero(usuario.xp)} / ${numero(necesaria)}*`
      );
    }
  },
  {
    name: "topnivel",
    category: "economia",
    desc: "Los de nivel más alto.",
    run: async ({ reply, store }) => {
      const filas = store.top("nivel", 10);
      if (!filas.length) return reply("🍅 Todavía nadie ha escrito lo suficiente.");
      return reply(`🍅 *Niveles*\n\n${filas.map((f, i) => `${i + 1}. ${nombreCorto(f.jid)} — nivel ${f.valor}`).join("\n")}`);
    }
  },
  ...Object.entries(ACCIONES).map(([nombre, accion]) => ({
    name: nombre,
    category: "economia",
    desc: `Acción de campo: ${nombre}. Da tomates y objetos.`,
    run: async ({ reply, store, msg }) => {
      const usuario = store.usuario(msg.sender);
      const espera = falta(usuario, nombre, ESPERA.accion);
      if (espera > 0) return reply(enEspera(espera, "volver a intentarlo"));
      usuario[`t_${nombre}`] = Date.now();
      const premio = azar(accion.premio[0], accion.premio[1]);
      darObjeto(usuario, accion.objeto);
      store.sumarCoins(msg.sender, premio);
      return reply(`${accion.texto} ${accion.nombre} y ganaste *${monedas(premio)}* + 1 ${accion.objeto}.`);
    }
  })),
  {
    name: "tienda",
    aliases: ["shop"],
    category: "economia",
    desc: "Muestra la tienda de objetos.",
    run: async ({ reply }) => {
      const lista = Object.entries(TIENDA)
        .map(([id, item]) => `· *${id}* — ${item.nombre} · ${monedas(item.precio)}`)
        .join("\n");
      return reply(`🍅 *Tienda*\n\n${lista}\n\nCompra con *.comprar <objeto>* y vende con *.vender <objeto>*`);
    }
  },
  {
    name: "comprar",
    aliases: ["buy"],
    category: "economia",
    desc: "Compra un objeto de la tienda.",
    usage: "<objeto>",
    run: async ({ reply, store, msg, text }) => {
      const id = text.trim().toLowerCase();
      const item = TIENDA[id];
      if (!item) return reply(`🍅 No existe *${id}*. Mira la lista con .tienda`);
      const usuario = store.usuario(msg.sender);
      if (usuario.coins < item.precio) return reply(`🍅 Te faltan *${monedas(item.precio - usuario.coins)}*.`);
      store.sumarCoins(msg.sender, -item.precio);
      darObjeto(usuario, id);
      store.marcar();
      return reply(`🍅 Compraste *${item.nombre}*.`);
    }
  },
  {
    name: "vender",
    aliases: ["sell"],
    category: "economia",
    desc: "Vende un objeto de tu inventario.",
    usage: "<objeto>",
    run: async ({ reply, store, msg, text }) => {
      const id = text.trim().toLowerCase();
      const usuario = store.usuario(msg.sender);
      const tiene = usuario.rpg.items[id] || 0;
      if (!tiene) {
        const inventario = Object.entries(usuario.rpg.items).map(([k, v]) => `${k}×${v}`).join(", ");
        return reply(`🍅 No tienes *${id}*.${inventario ? ` Tienes: ${inventario}` : " Inventario vacío."}`);
      }
      const precio = TIENDA[id]?.venta ?? (id === "tomate" ? 60 : id === "mineral" ? 50 : id === "madera" ? 45 : id === "pescado" ? 40 : id === "carne" ? 55 : 30);
      usuario.rpg.items[id] = tiene - 1;
      store.sumarCoins(msg.sender, precio);
      return reply(`🍅 Vendiste 1 ${id} por *${monedas(precio)}*.`);
    }
  },
  {
    name: "craftear",
    aliases: ["craft"],
    category: "economia",
    desc: "Junta materiales y arma algo que vale más.",
    run: async ({ reply, store, msg }) => {
      const usuario = store.usuario(msg.sender);
      const items = usuario.rpg.items;
      if ((items.mineral || 0) >= 2 && (items.madera || 0) >= 2) {
        items.mineral -= 2;
        items.madera -= 2;
        darObjeto(usuario, "espada");
        store.marcar();
        return reply("🍅 Crafteaste una *espada de madera* con 2 minerales y 2 maderas.");
      }
      return reply("🍅 Necesitas 2 minerales y 2 maderas (.minar y .talar).");
    }
  },
  {
    name: "entrenar",
    aliases: ["train"],
    category: "economia",
    desc: "Sube tu fuerza entrenando.",
    run: async ({ reply, store, msg }) => {
      const usuario = store.usuario(msg.sender);
      const espera = falta(usuario, "entrenar", ESPERA.accion);
      if (espera > 0) return reply(enEspera(espera, "entrenar otra vez"));
      usuario.t_entrenar = Date.now();
      const subida = azar(1, 3);
      usuario.rpg.fuerza += subida;
      store.marcar();
      return reply(`🍅 Entrenaste. Fuerza: *${usuario.rpg.fuerza}* (+${subida}).`);
    }
  },
  {
    name: "defensa",
    category: "economia",
    desc: "Sube tu defensa entrenando.",
    run: async ({ reply, store, msg }) => {
      const usuario = store.usuario(msg.sender);
      const espera = falta(usuario, "defensa", ESPERA.accion);
      if (espera > 0) return reply(enEspera(espera, "entrenar otra vez"));
      usuario.t_defensa = Date.now();
      const subida = azar(1, 3);
      usuario.rpg.defensa += subida;
      store.marcar();
      return reply(`🍅 Entrenaste defensa: *${usuario.rpg.defensa}* (+${subida}).`);
    }
  },
  {
    name: "einfo",
    aliases: ["perfilrpg", "stats"],
    category: "economia",
    desc: "Tu ficha de combate.",
    run: async ({ reply, store, msg }) => {
      const rpg = store.usuario(msg.sender).rpg;
      const inventario = Object.entries(rpg.items).filter(([, v]) => v > 0).map(([k, v]) => `${k}×${v}`).join(", ");
      return reply(
        `🍅 *Ficha de ${msg.pushName || msg.numero}*\n\n` +
          `· Vida: *${rpg.hp}/${rpg.hpMax}*\n` +
          `· Fuerza: *${rpg.fuerza}*\n` +
          `· Defensa: *${rpg.defensa}*\n` +
          `· Inventario: ${inventario || "vacío"}`
      );
    }
  },
  {
    name: "enemigos",
    aliases: ["mobs"],
    category: "economia",
    desc: "Lista de enemigos y su dificultad.",
    run: async ({ reply }) => {
      const enemigos = [
        ["Tomate podrido", 1], ["Rata de mercado", 2], ["Perro callejero", 3],
        ["Guardia del huerto", 5], ["Rey Jitomate", 8], ["El Tractor", 12]
      ];
      return reply(
        `🍅 *Enemigos*\n\n${enemigos.map(([n, d]) => `· ${n} — dificultad ${d}`).join("\n")}\n\n` +
          `Pelea con *.atacar <nombre>*`
      );
    }
  },
  {
    name: "atacar",
    aliases: ["pelear"],
    category: "economia",
    desc: "Pelea contra un enemigo. Gasta vida y puede dar botín.",
    usage: "<enemigo>",
    run: async ({ reply, store, msg, text }) => {
      const usuario = store.usuario(msg.sender);
      if (usuario.rpg.hp <= 0) return reply("🍅 Estás sin vida. Descansa con *.curar* antes de pelear.");
      const enemigo = (text || "").trim() || "Tomate podrido";
      const dificultad = Math.min(15, Math.max(1, enemigo.length % 13 + 1));
      const mio = usuario.rpg.fuerza + azar(0, 10);
      const suyo = dificultad * 2 + azar(0, 10);
      if (mio >= suyo) {
        const botin = dificultad * azar(80, 200);
        store.sumarCoins(msg.sender, botin);
        usuario.rpg.hp = Math.max(1, usuario.rpg.hp - azar(5, 20));
        store.marcar();
        return reply(`🍅 Venciste a *${enemigo}* y saqueaste *${monedas(botin)}*. Vida: ${usuario.rpg.hp}/${usuario.rpg.hpMax}`);
      }
      const dano = azar(10, 35);
      usuario.rpg.hp = Math.max(0, usuario.rpg.hp - dano);
      store.marcar();
      return reply(`🍅 *${enemigo}* te ganó. Perdiste ${dano} de vida. Te queda: ${usuario.rpg.hp}/${usuario.rpg.hpMax}`);
    }
  },
  {
    name: "curar",
    aliases: ["heal"],
    category: "economia",
    desc: "Recupera vida pagando tomates.",
    run: async ({ reply, store, msg }) => {
      const usuario = store.usuario(msg.sender);
      const costo = Math.max(0, (usuario.rpg.hpMax - usuario.rpg.hp) * 5);
      if (costo === 0) return reply("🍅 Estás al máximo de vida.");
      if (usuario.coins < costo) return reply(`🍅 Curarte cuesta *${monedas(costo)}* y no te alcanza.`);
      store.sumarCoins(msg.sender, -costo);
      usuario.rpg.hp = usuario.rpg.hpMax;
      store.marcar();
      return reply(`🍅 Pagaste *${monedas(costo)}* y quedaste al máximo de vida.`);
    }
  },
  {
    name: "boss",
    category: "economia",
    desc: "Enfréntate al jefe. Alto riesgo, alta recompensa.",
    run: async ({ reply, store, msg }) => {
      const usuario = store.usuario(msg.sender);
      const espera = falta(usuario, "boss", 4 * 3600_000);
      if (espera > 0) return reply(enEspera(espera, "volver a retar al jefe"));
      if (usuario.rpg.hp < 60) return reply("🍅 Necesitas al menos 60 de vida para retar al jefe.");
      usuario.t_boss = Date.now();
      if (azar(1, 100) <= 25) {
        const premio = azar(3000, 8000);
        store.sumarCoins(msg.sender, premio);
        store.marcar();
        return reply(`🍅 ¡Venciste al *Rey Jitomate*! Botín: *${monedas(premio)}*.`);
      }
      usuario.rpg.hp = Math.max(0, usuario.rpg.hp - azar(40, 70));
      store.marcar();
      return reply(`🍅 El *Rey Jitomate* te aplastó. Vida: ${usuario.rpg.hp}/${usuario.rpg.hpMax}`);
    }
  },
  {
    name: "dungeon",
    aliases: ["mazmorra"],
    category: "economia",
    desc: "Explora una mazmorra de tres salas.",
    run: async ({ reply, store, msg }) => {
      const usuario = store.usuario(msg.sender);
      const espera = falta(usuario, "dungeon", 2 * 3600_000);
      if (espera > 0) return reply(enEspera(espera, "volver a la mazmorra"));
      usuario.t_dungeon = Date.now();
      const salas = [];
      let total = 0;
      for (let i = 1; i <= 3; i++) {
        if (azar(1, 100) <= 65) {
          const botin = azar(300, 800) * i;
          total += botin;
          salas.push(`· Sala ${i}: venciste y ganaste *${monedas(botin)}*`);
        } else {
          salas.push(`· Sala ${i}: caíste y saliste con lo puesto`);
          break;
        }
      }
      if (total) store.sumarCoins(msg.sender, total);
      return reply(`🍅 *Mazmorra*\n\n${salas.join("\n")}\n\nTotal: *${monedas(total)}*`);
    }
  },
  {
    name: "duelo",
    category: "economia",
    desc: "Reta a alguien a un duelo. La otra persona acepta con .dueloaceptar",
    usage: "<@persona> <apuesta>",
    group: true,
    run: async ({ reply, store, chat, msg, args }) => {
      const quien = destinatario(msg, args);
      const apuesta = aCantidad(args[1], store.usuario(msg.sender).coins);
      if (!quien || quien === msg.sender) return reply("🍅 Dime a quién retas.");
      if (!apuesta || apuesta <= 0) return reply("🍅 Uso: .duelo @persona 200");
      if (store.usuario(msg.sender).coins < apuesta) return reply("🍅 No tienes esa cantidad.");
      const pendientes = store.chat(chat);
      pendientes.duelo = { retador: msg.sender, retado: quien, apuesta, cuando: Date.now() };
      store.marcar();
      return reply(`🍅 *${nombreCorto(msg.sender)}* reta a *${nombreCorto(quien)}* por *${monedas(apuesta)}*.\nAcepta con *.dueloaceptar*`);
    }
  },
  {
    name: "dueloaceptar",
    aliases: ["aceptarduelo"],
    category: "economia",
    desc: "Acepta el duelo pendiente del grupo.",
    group: true,
    run: async ({ reply, store, chat, msg }) => {
      const pendiente = store.chat(chat).duelo;
      if (!pendiente) return reply("🍅 No hay duelos pendientes.");
      if (Date.now() - pendiente.cuando > 10 * 60_000) {
        store.chat(chat).duelo = null;
        return reply("🍅 Ese duelo ya caducó.");
      }
      if (msg.sender !== pendiente.retado) return reply("🍅 Este duelo no es tuyo.");
      const retador = store.usuario(pendiente.retador);
      const retado = store.usuario(pendiente.retado);
      if (retador.coins < pendiente.apuesta || retado.coins < pendiente.apuesta) {
        store.chat(chat).duelo = null;
        return reply("🍅 Alguien ya no tiene la apuesta. Duelo cancelado.");
      }
      const fuerza = (u) => u.rpg.fuerza + u.rpg.defensa + azar(0, 15);
      const ganaRetador = fuerza(retador) >= fuerza(retado);
      const ganador = ganaRetador ? pendiente.retador : pendiente.retado;
      const perdedor = ganaRetador ? pendiente.retado : pendiente.retador;
      store.sumarCoins(perdedor, -pendiente.apuesta);
      store.sumarCoins(ganador, pendiente.apuesta);
      store.chat(chat).duelo = null;
      return reply(`🍅 Ganó *${nombreCorto(ganador)}* y se llevó *${monedas(pendiente.apuesta)}*.`);
    }
  },
  {
    name: "misiones",
    aliases: ["quests"],
    category: "economia",
    desc: "Misiones del día y su progreso.",
    run: async ({ reply, store, msg }) => {
      const usuario = store.usuario(msg.sender);
      const hoy = new Date().toISOString().slice(0, 10);
      if (usuario.misionesDia !== hoy) {
        usuario.misionesDia = hoy;
        usuario.misiones = {
          escribir: { meta: 30, hechas: azar(0, 10), premio: 300, texto: "Manda 30 mensajes" },
          trabajar: { meta: 1, hechas: 0, premio: 250, texto: "Usa .work una vez" },
          minar: { meta: 2, hechas: 0, premio: 350, texto: "Usa .minar dos veces" }
        };
        store.marcar();
      }
      const lista = Object.entries(usuario.misiones)
        .map(([, m]) => `· ${m.texto} — ${m.hechas}/${m.meta} → ${monedas(m.premio)}`)
        .join("\n");
      return reply(`🍅 *Misiones de hoy*\n\n${lista}\n\nSe completan solas al hacer la acción.`);
    }
  },
  {
    name: "reg",
    aliases: ["regalar"],
    category: "economia",
    desc: "Regala tomates a alguien.",
    usage: "<@persona> <cantidad>",
    run: async ({ reply, store, msg, args }) => {
      const quien = destinatario(msg, args);
      if (!quien || quien === msg.sender) return reply("🍅 Di a quién le regalas.");
      const cantidad = aCantidad(args[args.length - 1], store.usuario(msg.sender).coins);
      if (!cantidad || cantidad <= 0) return reply("🍅 Uso: .reg @persona 100");
      if (store.usuario(msg.sender).coins < cantidad) return reply("🍅 No te alcanza.");
      store.sumarCoins(msg.sender, -cantidad);
      store.sumarCoins(quien, cantidad);
      return reply(`🍅 Regalaste *${monedas(cantidad)}* a *${nombreCorto(quien)}*.`);
    }
  },
  {
    name: "regtest",
    category: "economia",
    desc: "Comprueba que el registro de economía responde (solo dueño).",
    owner: true,
    run: async ({ reply, store, msg }) => {
      const usuario = store.usuario(msg.sender);
      return reply(
        `🍅 *Prueba de economía*\n\n· En mano: ${monedas(usuario.coins)}\n· Banco: ${monedas(usuario.banco)}\n` +
          `· Nivel: ${usuario.nivel} (${numero(usuario.xp)} XP)\n· Registro: *OK*`
      );
    }
  }
];
