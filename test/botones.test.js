/**
 * Pruebas de los botones interactivos.
 *
 * Se comprueba lo importante: que el mensaje interactivo se arme bien, que los
 * ids de los botones sean comandos completos (para poder dispararlos) y que,
 * cuando el envío falla, llegue igual el contenido como texto.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { mandarBotones, deCopiar, deEnlace, deRespuesta, botonesActivos } from "../src/botones.js";
import { extraerTexto } from "../src/handler.js";

/** WhatsApp falso que apunta lo que se manda. */
function sockFalso({ conRelay = true, relayFalla = false } = {}) {
  const enviados = [];
  const retransmitidos = [];
  const sock = {
    user: { id: "5215500000000:1@s.whatsapp.net" },
    async sendMessage(jid, contenido) {
      enviados.push(contenido);
      return {};
    }
  };
  if (conRelay) {
    sock.relayMessage = async (jid, mensaje) => {
      if (relayFalla) throw new Error("WhatsApp rechazó el interactivo");
      retransmitidos.push(mensaje);
    };
  }
  return { sock, enviados, retransmitidos };
}

const EJEMPLO = {
  titulo: "🎧 Audio",
  texto: "Una canción",
  pie: "Tomate ofc bot",
  botones: [
    deRespuesta("🎧 Bajar audio", ".play https://youtu.be/abc"),
    deEnlace("🔗 YouTube", "https://youtu.be/abc"),
    deCopiar("📋 Copiar", "npm install")
  ]
};

test("los botones están activos por defecto", () => {
  assert.equal(botonesActivos(), true);
});

test("el mensaje interactivo se arma con los tres tipos de botón", async () => {
  const { sock, retransmitidos, enviados } = sockFalso();
  const salio = await mandarBotones(sock, "52155@s.whatsapp.net", EJEMPLO);

  assert.equal(salio, true);
  assert.equal(enviados.length, 0, "no debería mandar texto si los botones salieron");
  assert.equal(retransmitidos.length, 1);

  const interactivo = retransmitidos[0].viewOnceMessage.message.interactiveMessage;
  assert.equal(interactivo.body.text, "Una canción");
  assert.equal(interactivo.footer.text, "Tomate ofc bot");
  assert.equal(interactivo.header.title, "🎧 Audio");

  const botones = interactivo.nativeFlowMessage.buttons;
  assert.equal(botones.length, 3);
  assert.deepEqual(botones.map((b) => b.name), ["quick_reply", "cta_url", "cta_copy"]);

  const respuesta = JSON.parse(botones[0].buttonParamsJson);
  assert.equal(respuesta.id, ".play https://youtu.be/abc", "el id debe ser un comando completo");
  assert.equal(JSON.parse(botones[1].buttonParamsJson).url, "https://youtu.be/abc");
  assert.equal(JSON.parse(botones[2].buttonParamsJson).copy_code, "npm install");
});

test("si WhatsApp rechaza los botones, llega el texto numerado", async () => {
  const { sock, enviados } = sockFalso({ relayFalla: true });
  const salio = await mandarBotones(sock, "52155@s.whatsapp.net", EJEMPLO);

  assert.equal(salio, false);
  assert.equal(enviados.length, 1);
  const texto = enviados[0].text;
  assert.match(texto, /\*🎧 Audio\*/);
  assert.match(texto, /1\. 🎧 Bajar audio/);
  assert.match(texto, /youtu\.be\/abc/);
});

test("sin relayMessage también cae al texto", async () => {
  const { sock, enviados } = sockFalso({ conRelay: false });
  const salio = await mandarBotones(sock, "52155@s.whatsapp.net", EJEMPLO);
  assert.equal(salio, false);
  assert.equal(enviados.length, 1);
  assert.match(enviados[0].text, /Bajar audio/);
});

test("sin botones manda el texto directamente", async () => {
  const { sock, enviados } = sockFalso();
  const salio = await mandarBotones(sock, "52155@s.whatsapp.net", { texto: "Hola" });
  assert.equal(salio, false);
  assert.equal(enviados[0].text, "Hola");
});

test("el manejador entiende la respuesta de un botón", () => {
  const comoBoton = {
    buttonsResponseMessage: { selectedButtonId: ".play https://youtu.be/abc", selectedDisplayText: "Bajar audio" }
  };
  assert.equal(extraerTexto(comoBoton), ".play https://youtu.be/abc");

  const comoLista = { listResponseMessage: { singleSelectReply: { selectedRowId: ".menu" } } };
  assert.equal(extraerTexto(comoLista), ".menu");

  const comoPlantilla = { templateButtonReplyMessage: { selectedId: ".ping" } };
  assert.equal(extraerTexto(comoPlantilla), ".ping");

  const comoInteractivo = {
    interactiveResponseMessage: {
      nativeFlowResponseMessage: { paramsJson: JSON.stringify({ id: ".play2 https://youtu.be/abc" }) }
    }
  };
  assert.equal(extraerTexto(comoInteractivo), ".play2 https://youtu.be/abc");

  // Un JSON roto no debe romper el manejador.
  const roto = { interactiveResponseMessage: { nativeFlowResponseMessage: { paramsJson: "{no es json" } } };
  assert.equal(extraerTexto(roto), "");
});
