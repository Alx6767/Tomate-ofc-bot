import test from "node:test";
import assert from "node:assert/strict";

import { calcular } from "../src/calc.js";

test("suma, resta, multiplicación y división", () => {
  assert.equal(calcular("2+3"), 5);
  assert.equal(calcular("10-4"), 6);
  assert.equal(calcular("6*7"), 42);
  assert.equal(calcular("9/3"), 3);
});

test("respeta la precedencia", () => {
  assert.equal(calcular("2+3*4"), 14);
  assert.equal(calcular("(2+3)*4"), 20);
  assert.equal(calcular("2^3^2"), 512);
});

test("decimales con coma y con punto", () => {
  assert.equal(calcular("1,5+2,5"), 4);
  assert.equal(calcular("0.1+0.2").toFixed(1), "0.3");
});

test("funciones y constantes", () => {
  assert.equal(calcular("sqrt(16)"), 4);
  assert.equal(calcular("abs(-7)"), 7);
  assert.equal(calcular("round(pi)"), 3);
  assert.equal(calcular("floor(e)"), 2);
});

test("negativos y módulo", () => {
  assert.equal(calcular("-5+2"), -3);
  assert.equal(calcular("7%4"), 3);
});

test("rechaza texto en vez de ejecutarlo", () => {
  assert.throws(() => calcular("process.exit(1)"), /no es una función/);
  assert.throws(() => calcular("1;2"), /no permitido/);
  assert.throws(() => calcular(""), /vacía/);
  assert.throws(() => calcular("8/0"), /entre cero/);
});
