/**
 * Tomate ofc bot — configuración central.
 *
 * Todo lo que se puede cambiar sin tocar código vive aquí y se lee de
 * variables de entorno. El archivo `.env` es opcional: si no existe, el
 * bot arranca con los valores por defecto y muestra un QR para vincular.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Lector de `.env` sin dependencias.
 *
 * Formato admitido: `CLAVE=valor`, comentarios con `#`, comillas simples o
 * dobles opcionales y `\n` escapado dentro de las comillas dobles. No
 * sobrescribe variables que ya existan en el entorno: así se puede probar
 * con `OWNER=... npm start` sin editar el archivo.
 */
export function leerEnv(archivo = path.join(RAIZ, ".env")) {
  const valores = {};
  let crudo;
  try {
    crudo = fs.readFileSync(archivo, "utf8");
  } catch {
    return valores;
  }

  for (const linea of crudo.split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;

    const corte = limpia.indexOf("=");
    if (corte < 1) continue;

    const clave = limpia.slice(0, corte).trim();
    let valor = limpia.slice(corte + 1).trim();

    const entreComillasDobles = valor.startsWith('"') && valor.endsWith('"') && valor.length > 1;
    const entreComillasSimples = valor.startsWith("'") && valor.endsWith("'") && valor.length > 1;
    if (entreComillasDobles) valor = valor.slice(1, -1).replace(/\\n/g, "\n");
    else if (entreComillasSimples) valor = valor.slice(1, -1);
    else {
      // Comentario al final de la línea, solo si va separado por espacio.
      const comentario = valor.search(/\s#/);
      if (comentario !== -1) valor = valor.slice(0, comentario).trim();
    }

    valores[clave] = valor;
  }
  return valores;
}

const env = { ...leerEnv(), ...process.env };

/** Convierte "si/no/true/1" en un booleano de verdad. */
const si = (valor, porDefecto = false) => {
  if (valor === undefined || valor === "") return porDefecto;
  return /^(1|si|sí|true|yes|on)$/i.test(String(valor).trim());
};

/** Lista separada por comas, sin espacios ni entradas vacías. */
const lista = (valor, porDefecto = []) => {
  if (!valor) return porDefecto;
  return String(valor)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
};

export const config = {
  /** Nombre que se muestra en el menú y en las tarjetas. */
  nombre: env.BOT_NAME || "Tomate ofc bot",
  /** Emoji firma del bot. */
  emoji: env.BOT_EMOJI || "🍅",
  /** Prefijo de comandos. Admite varios: ".!/" */
  prefijos: env.PREFIXES ? [...String(env.PREFIXES)] : [".", "!", "/"],
  /** Números con permisos de dueño, sin "+" ni espacios. */
  owners: lista(env.OWNER).map((n) => n.replace(/\D/g, "")),
  /** Números con permisos de moderador (pueden usar comandos de owner suaves). */
  moderadores: lista(env.MODS).map((n) => n.replace(/\D/g, "")),
  /** Código de país para normalizar números escritos a medias. */
  pais: (env.COUNTRY || "MX").toUpperCase(),
  /** Método de vinculación: "qr" o "code". */
  metodo: (env.PAIRING || "qr").toLowerCase() === "code" ? "code" : "qr",
  /** Número con el que vincular cuando PAIRING=code. */
  numeroVinculacion: (env.PAIRING_NUMBER || "").replace(/\D/g, ""),
  /** Código fijo de 8 caracteres (opcional). Vacío = lo genera WhatsApp. */
  codigoVinculacion: (env.PAIRING_CODE || "").toUpperCase().replace(/[^A-Z0-9]/g, ""),
  /** Nombre del dispositivo que se ve en WhatsApp. */
  dispositivo: env.DEVICE_NAME || "Tomate ofc bot",
  /** Solo los dueños pueden usar el bot (modo privado). */
  modoPrivado: si(env.PRIVATE_MODE, false),
  /** Auto-aceptar solicitudes de unión a grupos por enlace. */
  autoAceptar: si(env.AUTO_JOIN, false),
  /** Anti-enlace: borra enlaces de grupo (chat.w hatsapp.com/...). */
  antiEnlace: si(env.ANTI_LINK, true),
  /** Anti-spam: cuántos mensajes seguidos se toleran por minuto. */
  antiSpam: Number(env.ANTI_SPAM || 0) || 0,
  /** Comandos de contenido adulto. Apagados salvo que se enciendan. */
  nsfw: si(env.NSFW, false),
  /** Claves opcionales de IA. Sin clave, esos comandos avisan y no fallan. */
  ia: {
    gemini: env.GEMINI_KEY || "",
    openai: env.OPENAI_KEY || "",
    groq: env.GROQ_KEY || ""
  },
  /** Zona horaria para `hora` y los récords. */
  zona: env.TZ || "America/Mexico_City",
  /** Tope de mensajes por minuto y chat (0 = sin límite). */
  ritmo: Number(env.RATE_LIMIT || 25) || 0,
  /** Carpetas de datos (sesión, base y temporales). */
  rutas: {
    sesion: path.join(RAIZ, env.SESSION_DIR || "sesion"),
    datos: path.join(RAIZ, env.DATA_DIR || "data"),
    temporales: path.join(RAIZ, "tmp"),
    assets: path.join(RAIZ, "assets")
  },
  /**
   * Botones interactivos. Si el cliente del que recibe no los soporta, el bot
   * manda el mismo contenido como texto numerado (ver `src/botones.js`).
   */
  botones: (env.BOTONES || "true").toLowerCase() !== "false",
  /** Enlaces que se muestran en el menú y en `botinfo`. */
  enlaces: {
    canal: env.CHANNEL || "",
    grupo: env.GROUP || "",
    repo: env.REPO || "https://github.com/Alx6767/Tomate-ofc-bot"
  }
};

/** ¿Ese número es dueño del bot? */
export function esDueno(numero) {
  const limpio = String(numero || "").replace(/\D/g, "");
  if (!limpio) return false;
  return config.owners.includes(limpio);
}

/** ¿Ese número es moderador? */
export function esModerador(numero) {
  const limpio = String(numero || "").replace(/\D/g, "");
  if (!limpio) return false;
  return config.moderadores.includes(limpio);
}
