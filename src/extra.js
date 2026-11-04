/**
 * Tomate ofc bot — piezas pequeñas compartidas.
 *
 * Cuenta-textos y los textos fijos de los comandos de diversión. Van aquí y no
 * dentro de un plugin para que dos comandos puedan usar la misma lista sin
 * importarse entre sí.
 */

import { elegir } from "./utils.js";

/** Cuenta caracteres, palabras y líneas sin romper acentos ni emoji. */
export function contarPalabras(texto) {
  const limpio = String(texto ?? "");
  const sinEspacios = limpio.replace(/\s/g, "");
  return {
    caracteres: [...limpio].length,
    sinEspacios: [...sinEspacios].length,
    palabras: limpio.trim() ? limpio.trim().split(/\s+/).length : 0,
    lineas: limpio ? limpio.split(/\r?\n/).length : 0
  };
}

/** Un elemento al azar (atajo, para que los plugins no importen utils). */
export const eleccionAleatoria = (lista) => elegir(lista);

export const RESPUESTAS_8BALL = [
  "Sí, sin duda. 🍅",
  "Todo apunta a que sí.",
  "Puedes darlo por hecho.",
  "Casi seguro.",
  "Sí, pero no hoy.",
  "Mejor no te contesto eso todavía.",
  "No cuentes con ello.",
  "Mi respuesta es no.",
  "Las señales dicen que no.",
  "Pregúntame cuando madure.",
  "Ni sí ni no: depende de ti.",
  "Eso solo lo sabe el tomate."
];

export const CHISTES = [
  "¿Qué le dice un tomate a otro? — Nos vemos en la ensalada.",
  "—Doctor, me siento como una verdura. —Es normal, eres un tomate.",
  "¿Por qué el tomate no miente? Porque siempre se le ve lo rojo.",
  "Un tomate cruza la calle y le gritan: ¡kétchup! y se tiró al suelo.",
  "¿Cuál es el colmo de un tomate? Que lo dejen plantado.",
  "—¿Cómo se despiden dos tomates? —Nos vemos en el súper.",
  "Mi vida es como un tomate: roja por fuera, pura semilla por dentro.",
  "¿Qué hace un tomate en un gimnasio? Ponerse en forma de salsa.",
  "El tomate le dice al aguacate: tú y yo hacemos un buen guacamole.",
  "—¿Por qué se cayó el tomate? —Porque no se agarró a la rama."
];

export const FRASES = [
  "El que madruga, encuentra el tomate fresco.",
  "No hay mala cosecha si aprendiste a sembrar.",
  "Lo que hoy es semilla, mañana es ensalada.",
  "Mejor rojo y maduro que verde y amargado.",
  "Cada quien cosecha lo que riega.",
  "El que no arriesga, no prueba la salsa.",
  "Las mejores cosas crecen despacio.",
  "Un tomate no se compara con otro: cada uno tiene su sabor.",
  "La paciencia también es una forma de cultivar.",
  "No todo lo que cae se pierde: a veces se siembra."
];

export const PIROPOS = [
  "¿Eres tomate? Porque te ves fresca y natural.",
  "Si fueras verdura, serías la más buscada de la feria.",
  "Me gustaría saber qué se siente estar en tu ensalada.",
  "Contigo hasta la salsa más simple sabe a restaurante.",
  "No eres cherry, eres de las que enamoran en serio.",
  "¿Tienes semillas? Porque quiero plantarte en mi huerto.",
  "Eres como el jitomate: no puedes faltar en mi mesa.",
  "Al lado tuyo hasta el pan con tomate es gourmet."
];

export const VERDADES = [
  "¿Cuál fue tu último mensaje borrado?",
  "¿A quién de este grupo le tienes más cariño?",
  "¿Cuál es el secreto más tonto que guardas?",
  "¿Qué canción te da vergüenza que te guste?",
  "¿Cuántas horas pasas en el teléfono al día?",
  "¿Qué harías con un día entero sin internet?",
  "¿Cuál fue la última mentira que dijiste?",
  "¿A quién le pedirías perdón ahora mismo?"
];

export const RETOS = [
  "Manda el último sticker que guardaste.",
  "Escribe un piropo a la tercera persona de este chat.",
  "Manda un audio cantando el estribillo de tu canción favorita.",
  "Cuenta un chiste malo sin reírte.",
  "Escribe un mensaje a alguien del grupo usando solo emojis.",
  "Cuenta tu día en tres palabras.",
  "Manda una foto de lo que tengas más cerca.",
  "Di en voz alta «soy un tomate» y mándanos el audio."
];

/** Signos con un rasgo del día, elegido de forma estable por fecha. */
export const SIGNOS = [
  "aries", "tauro", "geminis", "cancer", "leo", "virgo",
  "libra", "escorpio", "sagitario", "capricornio", "acuario", "piscis"
];

export const HOROSCOPOS = [
  "Hoy te conviene escuchar antes de opinar. 🍅",
  "Una conversación corta te va a ahorrar un problema largo.",
  "Día de ordenar: dinero, mensajes y excusas.",
  "Alguien va a agradecerte algo que hiciste sin darte cuenta.",
  "Buen día para empezar lo que llevas posponiendo.",
  "No confundas prisa con ganas: ve despacio y llegarás.",
  "Lo que hoy sembraste empieza a notarse.",
  "Cuida tu energía como cuidas tu cosecha.",
  "Un mensaje inesperado te va a cambiar el ánimo.",
  "Hoy es mejor decir «no sé» que improvisar una respuesta."
];
