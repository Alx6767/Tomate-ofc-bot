import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Store } from "../src/store.js";

/** Cada prueba usa su propio archivo para no ensuciar `data/`. */
function almacen() {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "tomate-store-"));
  return new Store(path.join(carpeta, "datos.json"));
}

test("el usuario nuevo trae los valores por defecto", () => {
  const store = almacen();
  const usuario = store.usuario("5215512345678@s.whatsapp.net");
  assert.equal(usuario.coins, 0);
  assert.equal(usuario.banco, 0);
  assert.equal(usuario.nivel, 1);
  assert.equal(usuario.rpg.hp, 100);
  assert.equal(usuario.rpg.hpMax, 100);
  assert.deepEqual(usuario.rpg.items, {});
  assert.equal(usuario.afk, null);
  assert.deepEqual(usuario.gacha.reclamados, []);
  // Un JID vacío devuelve una ficha desechable y no ensucia la base.
  const antes = Object.keys(store.datos.usuarios).length;
  store.usuario("");
  assert.equal(Object.keys(store.datos.usuarios).length, antes);
});

test("el mismo JID devuelve siempre el mismo objeto", () => {
  const store = almacen();
  const a = store.usuario("5215500000001@s.whatsapp.net");
  a.coins = 50;
  const b = store.usuario("5215500000001@s.whatsapp.net");
  assert.equal(b.coins, 50);
  assert.equal(a, b);
});

test("sumar, depositar y retirar respetan el saldo", () => {
  const store = almacen();
  const jid = "5215500000002@s.whatsapp.net";
  store.sumarCoins(jid, 1000);
  assert.equal(store.usuario(jid).coins, 1000);

  // depositar y retirar devuelven cuánto se movió de verdad.
  assert.equal(store.depositar(jid, 400), 400);
  assert.equal(store.usuario(jid).coins, 600);
  assert.equal(store.usuario(jid).banco, 400);

  assert.equal(store.retirar(jid, 100), 100);
  assert.equal(store.usuario(jid).coins, 700);
  assert.equal(store.usuario(jid).banco, 300);

  // No se puede sacar más de lo que hay: se mueve solo lo disponible.
  assert.equal(store.retirar(jid, 5000), 300);
  assert.equal(store.usuario(jid).banco, 0);
  assert.equal(store.usuario(jid).coins, 1000);
});

test("el saldo nunca queda negativo", () => {
  const store = almacen();
  const jid = "5215500000003@s.whatsapp.net";
  store.sumarCoins(jid, 100);
  store.sumarCoins(jid, -500);
  assert.equal(store.usuario(jid).coins, 0);
});

test("la experiencia sube de nivel y avisa", () => {
  const store = almacen();
  const jid = "5215500000004@s.whatsapp.net";
  let subidas = 0;
  for (let i = 0; i < 40; i++) {
    if (store.darXp(jid, 50).subio) subidas++;
  }
  const usuario = store.usuario(jid);
  assert.ok(usuario.nivel > 1, "debería haber subido de nivel");
  assert.ok(subidas > 0, "debería avisar de al menos una subida");
  assert.ok(usuario.xp >= 0);
});

test("top ordena y no mezcla usuarios sin datos", () => {
  const store = almacen();
  store.sumarCoins("5215500000010@s.whatsapp.net", 300);
  store.sumarCoins("5215500000011@s.whatsapp.net", 900);
  store.sumarCoins("5215500000012@s.whatsapp.net", 100);
  const top = store.top("coins", 3);
  assert.equal(top.length, 3);
  assert.equal(top[0].jid, "5215500000011@s.whatsapp.net");
  assert.equal(top[0].valor, 900);
});

test("los datos sobreviven a reabrir el archivo", () => {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "tomate-store-"));
  const archivo = path.join(carpeta, "datos.json");
  const primero = new Store(archivo);
  primero.sumarCoins("5215500000020@s.whatsapp.net", 777);
  primero.usuario("5215500000020@s.whatsapp.net").afk = "comiendo";
  primero.guardarAhora();

  const segundo = new Store(archivo);
  assert.equal(segundo.usuario("5215500000020@s.whatsapp.net").coins, 777);
  assert.equal(segundo.usuario("5215500000020@s.whatsapp.net").afk, "comiendo");
});

test("un archivo corrupto se aparta en vez de perderse", () => {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "tomate-store-"));
  const archivo = path.join(carpeta, "datos.json");
  fs.writeFileSync(archivo, "{ esto no es json");
  const store = new Store(archivo);
  assert.deepEqual(store.datos.usuarios, {});
  const apartados = fs.readdirSync(carpeta).filter((f) => f.includes(".corrupto-"));
  assert.equal(apartados.length, 1);
});
