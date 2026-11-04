import test from "node:test";
import assert from "node:assert/strict";

import { cargarPlugins, CATEGORIAS, ORDEN_CATEGORIAS } from "../src/loader.js";
import { construirMenu } from "../src/menu.js";

const { comandos, lista, fallos } = await cargarPlugins();

test("todos los plugins cargan sin fallos", () => {
  assert.deepEqual(fallos, []);
  assert.ok(lista.length > 150, `esperaba más de 150 comandos y hay ${lista.length}`);
});

test("no hay nombres ni alias repetidos", () => {
  const vistos = new Map();
  for (const comando of lista) {
    for (const clave of [comando.name, ...(comando.aliases || [])]) {
      const previo = vistos.get(clave);
      assert.equal(previo, undefined, `«${clave}» lo usan ${previo} y ${comando.name}`);
      vistos.set(clave, comando.name);
    }
  }
});

test("cada comando tiene lo mínimo y una categoría conocida", () => {
  for (const comando of lista) {
    assert.equal(typeof comando.run, "function", `${comando.name} no tiene run`);
    assert.ok(comando.desc, `${comando.name} no tiene descripción`);
    assert.ok(CATEGORIAS[comando.category], `${comando.name} usa la categoría «${comando.category}»`);
    assert.equal(comando.name, comando.name.toLowerCase(), `${comando.name} debe ir en minúsculas`);
    assert.ok(!/\s/.test(comando.name), `${comando.name} no puede llevar espacios`);
  }
});

test("todas las categorías del orden existen", () => {
  for (const id of ORDEN_CATEGORIAS) {
    assert.ok(CATEGORIAS[id], `la categoría «${id}» del orden no existe`);
  }
});

test("el registro indexa nombre y alias al mismo comando", () => {
  const comando = comandos.get("ping");
  assert.ok(comando, "falta el comando ping");
  for (const alias of comando.aliases || []) {
    assert.equal(comandos.get(alias), comando, `el alias ${alias} no apunta a ping`);
  }
});

test("el menú nombra todos los comandos", () => {
  const menu = construirMenu({ lista, usuarios: 120 });
  for (const comando of lista) {
    assert.ok(menu.includes(comando.name), `el menú no muestra ${comando.name}`);
  }
  assert.ok(menu.includes("Tomate ofc"));
  assert.ok(menu.includes(String(lista.length)));
});

test("los comandos de owner están marcados como tales", () => {
  const peligrosos = ["eval", "backup", "savefile", "setcmd", "restart", "updategithub", "codemod", "saveper"];
  for (const nombre of peligrosos) {
    const comando = comandos.get(nombre);
    if (!comando) continue; // Si no existe, no hay nada que proteger.
    assert.equal(comando.owner, true, `«${nombre}» debe ser solo del dueño`);
  }
});

test("los comandos de adultos exigen nsfw", () => {
  for (const nombre of ["r34", "xnxx", "xvideos"]) {
    const comando = comandos.get(nombre);
    assert.ok(comando, `falta ${nombre}`);
    assert.equal(comando.nsfw, true, `«${nombre}» debe pedir nsfw`);
  }
});
