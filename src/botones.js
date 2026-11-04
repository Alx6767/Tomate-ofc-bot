/**
 * Tomate ofc bot — botones nativos de WhatsApp.
 *
 * WhatsApp permite tres tipos de botón dentro de un mensaje interactivo:
 *
 *   · respuesta → el usuario toca y llega un mensaje con un `id`
 *   · enlace    → abre una URL
 *   · copiar    → copia un texto al portapapeles
 *
 * Esto se manda con `relayMessage`, que es la vía que usan los clientes no
 * oficiales. No siempre está disponible (depende de la versión de WhatsApp del
 * que recibe), así que **todo aquí tiene respaldo**: si el envío falla, se manda
 * el mismo contenido como texto numerado y el bot sigue funcionando igual.
 *
 * Los botones de tipo «respuesta» llevan como `id` un comando completo, por
 * ejemplo `.play2 https://youtu.be/xxx`. El manejador lo recibe como si la
 * persona lo hubiera escrito: así no hace falta una tabla de callbacks.
 */

import { config } from "./config.js";

/** ¿Se pueden mandar botones en este arranque? */
export function botonesActivos() {
  return Boolean(config.botones);
}

/** Construye un botón de respuesta. */
export const deRespuesta = (texto, comando) => ({
  tipo: "respuesta",
  texto,
  id: comando
});

/** Construye un botón de enlace. */
export const deEnlace = (texto, url) => ({ tipo: "enlace", texto, url });

/** Construye un botón de copiar. */
export const deCopiar = (texto, codigo) => ({ tipo: "copiar", texto, codigo });

/** Traduce un botón al formato interno de WhatsApp. */
function aNativo(boton) {
  if (boton.tipo === "enlace") {
    return {
      name: "cta_url",
      buttonParamsJson: JSON.stringify({
        display_text: boton.texto,
        url: boton.url,
        merchant_url: boton.url
      })
    };
  }
  if (boton.tipo === "copiar") {
    return {
      name: "cta_copy",
      buttonParamsJson: JSON.stringify({
        display_text: boton.texto,
        copy_code: boton.codigo,
        id: `copiar_${Date.now()}`
      })
    };
  }
  return {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({ display_text: boton.texto, id: boton.id })
  };
}

/** Texto de respaldo cuando los botones no salen. */
function comoTexto({ titulo, texto, pie, botones = [] }) {
  const lineas = [titulo ? `*${titulo}*` : "", texto, ""];
  botones.forEach((boton, i) => {
    if (boton.tipo === "enlace") lineas.push(`${i + 1}. ${boton.texto}: ${boton.url}`);
    else if (boton.tipo === "copiar") lineas.push(`${i + 1}. ${boton.texto}: ${boton.codigo}`);
    else lineas.push(`${i + 1}. ${boton.texto} → ${boton.id}`);
  });
  if (pie) lineas.push("", `_${pie}_`);
  return lineas.filter((l) => l !== undefined).join("\n").trim();
}

/**
 * Manda un mensaje con botones. Si no se puede, manda el texto equivalente.
 *
 * @param {object} sock socket de Baileys
 * @param {string} jid destinatario
 * @param {object} contenido `{ titulo, texto, pie, botones }`
 * @param {object} [opciones] `{ quoted }`
 * @returns {Promise<boolean>} true si salió con botones
 */
export async function mandarBotones(sock, jid, contenido, opciones = {}) {
  const { botones = [] } = contenido;
  const respaldo = () =>
    sock.sendMessage(jid, { text: comoTexto(contenido) }, opciones).then(() => false).catch(() => false);

  if (!botonesActivos() || !botones.length) return respaldo();

  let baileys;
  try {
    baileys = await import("@whiskeysockets/baileys");
  } catch {
    return respaldo();
  }

  const { proto, generateWAMessageFromContent } = baileys;
  if (!proto?.Message?.fromObject || !generateWAMessageFromContent) return respaldo();

  try {
    const arbol = proto.Message.fromObject({
      viewOnceMessage: {
        message: {
          messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
          interactiveMessage: {
            body: { text: contenido.texto || "" },
            footer: { text: contenido.pie || config.nombre },
            header: {
              title: contenido.titulo || config.nombre,
              hasMediaAttachment: false
            },
            nativeFlowMessage: {
              buttons: botones.slice(0, 10).map(aNativo),
              messageParamsJson: ""
            }
          }
        }
      }
    });

    const armado = generateWAMessageFromContent(jid, arbol, {
      userJid: sock.user?.id,
      quoted: opciones.quoted
    });

    if (typeof sock.relayMessage !== "function") return respaldo();
    await sock.relayMessage(jid, armado.message, { messageId: armado.key.id });
    return true;
  } catch {
    // WhatsApp rechazó el interactivo: se manda el texto y ya.
    return respaldo();
  }
}

export default mandarBotones;
