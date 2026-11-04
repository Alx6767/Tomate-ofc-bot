/**
 * Tomate ofc bot — calculadora sin `eval`.
 *
 * El comando `calc` recibe texto de cualquiera. Pasarlo a `eval` convierte el
 * bot en una puerta abierta, así que aquí se interpreta la expresión con un
 * analizador propio: primero se parte en fichas, luego se pasa a notación
 * polaca con el algoritmo de shunting-yard y por último se evalúa la pila.
 *
 * Admite: números (con decimales), + - * / % ^, paréntesis, funciones
 * (raíz, seno, coseno, tangente, logaritmo, absoluto, redondeos) y las
 * constantes pi y e. Cualquier otra cosa es un error con mensaje claro.
 */

const FUNCIONES = {
  sqrt: Math.sqrt,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  ln: Math.log,
  log: Math.log10,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  exp: Math.exp
};

const CONSTANTES = { pi: Math.PI, e: Math.E };

// `neg` es el menos unario: va por delante de todo lo demás para que
// -5+2 sea 3 y no -7.
const PRECEDENCIA = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2, "^": 3, neg: 4 };
const DERECHA = new Set(["^"]);

/** Parte la expresión en fichas. Lanza si aparece algo que no es un número. */
export function fichas(expresion) {
  const texto = String(expresion || "").replace(/,/g, ".").replace(/\s+/g, "");
  if (!texto) throw new Error("expresión vacía");
  const salida = [];
  let i = 0;

  while (i < texto.length) {
    const caracter = texto[i];

    if (/[0-9.]/.test(caracter)) {
      let numero = "";
      while (i < texto.length && /[0-9.]/.test(texto[i])) numero += texto[i++];
      if (!/^\d*\.?\d+$/.test(numero)) throw new Error(`número mal escrito: ${numero}`);
      salida.push({ tipo: "numero", valor: Number(numero) });
      continue;
    }

    if (/[a-zA-Z]/.test(caracter)) {
      let nombre = "";
      while (i < texto.length && /[a-zA-Z]/.test(texto[i])) nombre += texto[i++];
      const clave = nombre.toLowerCase();
      if (clave in CONSTANTES) salida.push({ tipo: "numero", valor: CONSTANTES[clave] });
      else if (clave in FUNCIONES) salida.push({ tipo: "funcion", valor: clave });
      else throw new Error(`«${nombre}» no es una función que conozca`);
      continue;
    }

    if (caracter in PRECEDENCIA) {
      salida.push({ tipo: "operador", valor: caracter });
      i++;
      continue;
    }

    if (caracter === "(" || caracter === ")") {
      salida.push({ tipo: caracter });
      i++;
      continue;
    }

    throw new Error(`carácter no permitido: «${caracter}»`);
  }

  return salida;
}

/** Convierte las fichas a notación polaca inversa. */
export function aPolaca(lista) {
  const salida = [];
  const pila = [];
  let anterior = null;

  for (const ficha of lista) {
    if (ficha.tipo === "numero") {
      salida.push(ficha);
    } else if (ficha.tipo === "funcion") {
      pila.push(ficha);
    } else if (ficha.tipo === "operador") {
      // Un signo menos delante de un número es negación, no resta.
      const unario = ficha.valor === "-" && (anterior === null || anterior.tipo === "operador" || anterior.tipo === "(");
      if (unario) {
        pila.push({ tipo: "operador", valor: "neg" });
      } else {
        while (pila.length) {
          const tope = pila[pila.length - 1];
          const topeOperador = tope.tipo === "operador";
          const mismoNivel = topeOperador && PRECEDENCIA[tope.valor] === PRECEDENCIA[ficha.valor] && !DERECHA.has(ficha.valor);
          const masFuerte = topeOperador && PRECEDENCIA[tope.valor] > PRECEDENCIA[ficha.valor];
          const funcionPendiente = tope.tipo === "funcion";
          if (mismoNivel || masFuerte || funcionPendiente) salida.push(pila.pop());
          else break;
        }
        pila.push(ficha);
      }
    } else if (ficha.tipo === "(") {
      pila.push(ficha);
    } else if (ficha.tipo === ")") {
      while (pila.length && pila[pila.length - 1].tipo !== "(") salida.push(pila.pop());
      if (!pila.length) throw new Error("falta un paréntesis de apertura");
      pila.pop();
      if (pila.length && pila[pila.length - 1].tipo === "funcion") salida.push(pila.pop());
    }
    anterior = ficha;
  }

  while (pila.length) {
    const tope = pila.pop();
    if (tope.tipo === "(") throw new Error("falta un paréntesis de cierre");
    salida.push(tope);
  }
  return salida;
}

/** Evalúa la notación polaca. */
export function evaluarPolaca(polaca) {
  const pila = [];
  for (const ficha of polaca) {
    if (ficha.tipo === "numero") {
      pila.push(ficha.valor);
      continue;
    }
    if (ficha.tipo === "funcin") throw new Error("ficha inválida");
    if (ficha.tipo === "funcion") {
      const valor = pila.pop();
      if (valor === undefined) throw new Error(`a «${ficha.valor}» le falta el número`);
      pila.push(FUNCIONES[ficha.valor](valor));
      continue;
    }
    if (ficha.valor === "neg") {
      const valor = pila.pop();
      if (valor === undefined) throw new Error("falta un número para el signo");
      pila.push(-valor);
      continue;
    }
    const derecha = pila.pop();
    const izquierda = pila.pop();
    if (izquierda === undefined || derecha === undefined) throw new Error("faltan números en la operación");
    switch (ficha.valor) {
      case "+": pila.push(izquierda + derecha); break;
      case "-": pila.push(izquierda - derecha); break;
      case "*": pila.push(izquierda * derecha); break;
      case "/":
        if (derecha === 0) throw new Error("no se puede dividir entre cero");
        pila.push(izquierda / derecha);
        break;
      case "%":
        if (derecha === 0) throw new Error("no se puede sacar módulo cero");
        pila.push(izquierda % derecha);
        break;
      case "^": pila.push(izquierda ** derecha); break;
      default: throw new Error(`operador desconocido: ${ficha.valor}`);
    }
  }
  if (pila.length !== 1) throw new Error("la expresión quedó incompleta");
  const resultado = pila[0];
  if (!Number.isFinite(resultado)) throw new Error("el resultado no es un número finito");
  return resultado;
}

/**
 * Resuelve una expresión y devuelve el número.
 * @param {string} expresion
 * @returns {number}
 */
export function calcular(expresion) {
  return evaluarPolaca(aPolaca(fichas(expresion)));
}

export default calcular;
