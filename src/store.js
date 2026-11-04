/**
 * Tomate ofc bot — almacén de datos.
 *
 * Un solo archivo JSON, escritura diferida y guardado forzoso al salir. Se
 * eligió JSON y no SQLite a propósito: el bot tiene que arrancar en un
 * teléfono con Termux sin compilar nada, y el volumen de datos de un bot de
 * grupo (unas decenas de miles de registros como mucho) cabe de sobra en
 * memoria.
 *
 * Reglas que se respetan en todo el archivo:
 *
 *   · Nunca se pierde lo que ya estaba: si el archivo no se puede leer, se
 *     aparta a `datos.corrupto-<fecha>.json` en vez de sobrescribirlo.
 *   · Los valores por defecto se rellenan al leer, no al escribir: así una
 *     versión nueva del bot no necesita migración para añadir un campo.
 *   · Nada de escrituras por mensaje: se agrupan cada 4 segundos.
 */

import fs from "node:fs";
import path from "node:path";
import log from "./logger.js";

const VACIO = () => ({ version: 1, usuarios: {}, chats: {}, global: {} });

/** Valores de un usuario nuevo. */
const USUARIO_NUEVO = () => ({
  coins: 0,
  banco: 0,
  xp: 0,
  nivel: 1,
  diario: 0,
  trabajo: 0,
  crimen: 0,
  robo: 0,
  pareja: null,
  familia: null,
  hijos: [],
  perfil: {
    desc: "",
    cumple: "",
    genero: "",
    hobby: "",
    edad: null
  },
  gacha: {
    reclamados: [],
    seleccionado: null
  },
  rpg: {
    hp: 100,
    hpMax: 100,
    fuerza: 5,
    defensa: 3,
    items: {}
  },
  afk: null,
  pokemon: {
    equipo: [],
    caja: []
  }
});

export class Store {
  #archivo;
  #datos;
  #temporizador = null;
  #sucio = false;

  constructor(archivo) {
    this.#archivo = archivo;
    this.#datos = this.#cargar();
    const salir = () => this.guardarAhora();
    process.once("exit", salir);
    process.once("SIGINT", () => {
      salir();
      process.exit(0);
    });
    process.once("SIGTERM", () => {
      salir();
      process.exit(0);
    });
  }

  /** Datos completos (lectura). */
  get datos() {
    return this.#datos;
  }

  #cargar() {
    try {
      const crudo = fs.readFileSync(this.#archivo, "utf8");
      const datos = JSON.parse(crudo);
      if (!datos || typeof datos !== "object") throw new Error("contenido inesperado");
      return { ...VACIO(), ...datos };
    } catch (error) {
      if (error.code === "ENOENT") return VACIO();
      // No se borra ni se sobrescribe: se aparta y se avisa.
      const apartado = `${this.#archivo}.corrupto-${Date.now()}.json`;
      try {
        fs.renameSync(this.#archivo, apartado);
        log.error(`base ilegible (${error.message}); se apartó en ${path.basename(apartado)}`);
      } catch {
        log.error(`base ilegible y no se pudo apartar: ${error.message}`);
      }
      return VACIO();
    }
  }

  /**
   * Usuario por JID. Si no existe se crea con los valores por defecto, y si
   * existe se le rellenan los campos que falten.
   */
  usuario(jid) {
    const id = String(jid || "");
    if (!id) return USUARIO_NUEVO();
    if (!this.#datos.usuarios[id]) {
      this.#datos.usuarios[id] = USUARIO_NUEVO();
      this.marcar();
    }
    const actual = this.#datos.usuarios[id];
    const base = USUARIO_NUEVO();
    for (const [clave, valor] of Object.entries(base)) {
      if (actual[clave] === undefined) {
        actual[clave] = valor;
      } else if (valor && typeof valor === "object" && !Array.isArray(valor)) {
        actual[clave] = { ...valor, ...actual[clave] };
      }
    }
    return actual;
  }

  /** Ajustes de un chat o grupo (bienvenida, antilink, mute…). */
  chat(jid) {
    const id = String(jid || "");
    if (!id) return {};
    if (!this.#datos.chats[id]) {
      this.#datos.chats[id] = { bienvenida: false, antilink: true, mute: false, warns: {} };
      this.marcar();
    }
    return this.#datos.chats[id];
  }

  /** Guarda un valor global (sorteos, contadores, última sesión). */
  global(clave, valor) {
    if (valor === undefined) return this.#datos.global[clave];
    this.#datos.global[clave] = valor;
    this.marcar();
    return valor;
  }

  /** Suma (o resta, con cantidad negativa) sin bajar de cero. */
  sumarCoins(jid, cantidad) {
    const usuario = this.usuario(jid);
    usuario.coins = Math.max(0, Math.round(usuario.coins + Number(cantidad || 0)));
    this.marcar();
    return usuario.coins;
  }

  /** Mete dinero en el banco. Devuelve cuánto entró de verdad. */
  depositar(jid, cantidad) {
    const usuario = this.usuario(jid);
    const monto = Math.max(0, Math.min(Math.round(Number(cantidad) || 0), usuario.coins));
    usuario.coins -= monto;
    usuario.banco += monto;
    this.marcar();
    return monto;
  }

  /** Saca dinero del banco. Devuelve cuánto salió de verdad. */
  retirar(jid, cantidad) {
    const usuario = this.usuario(jid);
    const monto = Math.max(0, Math.min(Math.round(Number(cantidad) || 0), usuario.banco));
    usuario.banco -= monto;
    usuario.coins += monto;
    this.marcar();
    return monto;
  }

  /**
   * Da experiencia y sube de nivel cuando toca.
   *
   * La curva es nivel² × 100: subir del 1 al 2 pide 100 puntos, del 5 al 6
   * pide 2500. Crece rápido para que el nivel alto signifique algo.
   *
   * @returns {{subio: boolean, nivel: number, falta: number}}
   */
  darXp(jid, cantidad = 10) {
    const usuario = this.usuario(jid);
    usuario.xp += Math.max(0, Math.round(cantidad));
    let subio = false;
    for (;;) {
      const necesaria = Math.max(100, usuario.nivel ** 2 * 100);
      if (usuario.xp < necesaria) break;
      usuario.xp -= necesaria;
      usuario.nivel += 1;
      subio = true;
    }
    this.marcar();
    return { subio, nivel: usuario.nivel, falta: Math.max(100, usuario.nivel ** 2 * 100) - usuario.xp };
  }

  /**
   * Tabla de posiciones por un campo numérico.
   * @returns {Array<{jid: string, valor: number}>}
   */
  top(campo = "coins", limite = 10) {
    return Object.entries(this.#datos.usuarios)
      .map(([jid, usuario]) => ({
        jid,
        valor: campo === "total" ? usuario.coins + usuario.banco : Number(usuario[campo] || 0)
      }))
      .filter((fila) => fila.valor > 0)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, limite);
  }

  marcar() {
    this.#sucio = true;
    if (this.#temporizador) return;
    this.#temporizador = setTimeout(() => {
      this.#temporizador = null;
      this.guardarAhora();
    }, 4000);
    this.#temporizador.unref?.();
  }

  /** Escritura inmediata y atómica (archivo temporal + rename). */
  guardarAhora() {
    if (!this.#sucio) return false;
    try {
      fs.mkdirSync(path.dirname(this.#archivo), { recursive: true });
      const temporal = `${this.#archivo}.tmp`;
      fs.writeFileSync(temporal, JSON.stringify(this.#datos, null, 1));
      fs.renameSync(temporal, this.#archivo);
      this.#sucio = false;
      return true;
    } catch (error) {
      log.error(`no se pudo guardar la base: ${error.message}`);
      return false;
    }
  }
}

export default Store;
