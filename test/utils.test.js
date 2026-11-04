import test from "node:test";
import assert from "node:assert/strict";

import {
  aCantidad, barra, duracion, elegir, monedas, nombreCorto, normalizarTelefono,
  numero, partir, recortar, simplificar, soloDigitos
} from "../src/utils.js";

test("soloDigitos y normalizarTelefono", () => {
  assert.equal(soloDigitos("+52 (55) 1234-5678"), "525512345678");
  assert.equal(normalizarTelefono("5215512345678"), "5215512345678");
  assert.equal(normalizarTelefono("+52 1 55 1234 5678"), "5215512345678");
  // Un número local de 10 dígitos se completa con el país del .env (MX).
  assert.equal(normalizarTelefono("5512345678"), "525512345678");
  assert.equal(normalizarTelefono("abc"), "");
});

test("nombreCorto saca el número del JID", () => {
  assert.equal(nombreCorto("5215512345678@s.whatsapp.net"), "5215512345678");
  assert.equal(nombreCorto("5215512345678:12@s.whatsapp.net"), "5215512345678");
  assert.equal(nombreCorto(""), "");
});

test("aCantidad entiende k, m y palabras", () => {
  assert.equal(aCantidad("100"), 100);
  assert.equal(aCantidad("1k"), 1000);
  assert.equal(aCantidad("2.5k"), 2500);
  // «todo» sin saldo conocido no se puede resolver, y la basura tampoco.
  assert.equal(aCantidad("todo"), null);
  assert.equal(aCantidad("todo", 750.9), 750);
  assert.equal(aCantidad("basura"), null);
});

test("monedas y numero formatean con separadores", () => {
  assert.match(monedas(1500), /1[.,]500/);
  assert.match(numero(1234567), /1[.,]234[.,]567/);
});

test("duracion en segundos, minutos y horas", () => {
  assert.equal(duracion(5000), "5s");
  assert.equal(duracion(90_000), "1m 30s");
  assert.equal(duracion(3 * 3600_000), "3h");
});

test("barra dibuja el progreso sin salirse", () => {
  const llena = barra(10, 10, 5);
  assert.equal(llena, "▰▰▰▰▰ 100%");
  const vacia = barra(0, 10, 5);
  assert.equal(vacia, "▱▱▱▱▱ 0%");
  const media = barra(5, 10, 10);
  assert.equal(media, "▰▰▰▰▰▱▱▱▱▱ 50%");
});

test("partir separa el comando del resto", () => {
  assert.deepEqual(partir("hola mundo cruel"), { primero: "hola", resto: "mundo cruel" });
  assert.deepEqual(partir("menu"), { primero: "menu", resto: "" });
  assert.deepEqual(partir("   "), { primero: "", resto: "" });
});

test("recortar y simplificar", () => {
  assert.equal(recortar("abcdef", 3), "abc…");
  assert.equal(recortar("abc", 10), "abc");
  assert.equal(simplificar("  ÑANDÚ   Rojo "), "nandu rojo");
});

test("elegir siempre devuelve un elemento de la lista", () => {
  const lista = ["a", "b", "c"];
  for (let i = 0; i < 50; i++) assert.ok(lista.includes(elegir(lista)));
});
