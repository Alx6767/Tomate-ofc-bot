/**
 * Tomate ofc bot — comandos de dueño.
 *
 * Todo lo de este archivo puede cambiar el bot o el servidor donde vive, así
 * que cada comando exige `owner: true` y la comprobación se hace ANTES de
 * ejecutar nada. El dueño es quien esté en `OWNER` dentro del `.env`.
 *
 * `eval` se queda, porque para depurar un bot en el teléfono es la única
 * herramienta cómoda, pero con dos condiciones: solo el dueño y cada uso
 * queda escrito en la consola. Si no se necesita, se borra este archivo y el
 * comando desaparece del menú.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { config, RAIZ } from "../src/config.js";
import { fecha, nombreCorto, recortar } from "../src/utils.js";

/** Ejecuta un programa con argumentos separados (nunca una cadena de shell). */
function correr(programa, argumentos, cwd = RAIZ) {
  return new Promise((resolver) => {
    const proceso = spawn(programa, argumentos, { cwd });
    let salida = "";
    proceso.stdout.on("data", (t) => {
      salida += t.toString();
    });
    proceso.stderr.on("data", (t) => {
      salida += t.toString();
    });
    proceso.on("error", (error) => resolver({ codigo: -1, salida: error.message }));
    proceso.on("close", (codigo) => resolver({ codigo, salida }));
  });
}

export default [
  {
    name: "eval",
    aliases: ["exec"],
    category: "owner",
    desc: "Ejecuta JavaScript en el proceso del bot. Solo dueño.",
    usage: "<código>",
    owner: true,
    run: async ({ reply, text, msg }) => {
      if (!text) return reply("🍅 Pásame el código a ejecutar.");
      console.log(`[eval] ${msg.numero}: ${recortar(text, 200)}`);
      try {
        // Se ejecuta en una función asíncrona para poder usar await.
        const resultado = await (async () => {
          // eslint-disable-next-line no-new-func
          const funcion = new Function("sock", `return (async () => { ${text} })()`);
          return await funcion(globalThis.__tomateSock);
        })();
        const texto = typeof resultado === "string" ? resultado : JSON.stringify(resultado, null, 1);
        return reply("```" + recortar(texto ?? "sin resultado", 3000) + "```");
      } catch (error) {
        return reply(`🍅 Error: ${recortar(error.message, 500)}`);
      }
    }
  },
  {
    name: "r",
    aliases: ["reload", "recargar"],
    category: "owner",
    desc: "Vuelve a cargar los plugins sin reiniciar el bot.",
    owner: true,
    run: async ({ reply }) => {
      if (typeof globalThis.__tomateRecargar !== "function") {
        return reply("🍅 La recarga no está disponible en este arranque.");
      }
      const nuevo = await globalThis.__tomateRecargar();
      const fallos = nuevo.fallos.length ? `\n\nCon problemas:\n${nuevo.fallos.slice(0, 5).join("\n")}` : "";
      return reply(`🍅 Recargado: *${nuevo.lista.length}* comandos.${fallos}`);
    }
  },
  {
    name: "restart",
    aliases: ["reiniciar"],
    category: "owner",
    desc: "Reinicia el proceso. Necesita un supervisor que lo vuelva a arrancar.",
    owner: true,
    run: async ({ reply }) => {
      await reply("🍅 Reiniciando… (si no vuelve en 5 s, arráncalo a mano).");
      setTimeout(() => process.exit(0), 500);
      return true;
    }
  },
  {
    name: "backup",
    aliases: ["respaldo"],
    category: "owner",
    desc: "Manda un respaldo de la base como archivo.",
    owner: true,
    run: async ({ reply, store, send, chat }) => {
      try {
        const destino = path.join(config.rutas.temporales, `respaldo-${Date.now()}.json`);
        fs.mkdirSync(config.rutas.temporales, { recursive: true });
        fs.writeFileSync(destino, JSON.stringify(store.datos, null, 1));
        const bytes = fs.readFileSync(destino);
        fs.rmSync(destino, { force: true });
        await send(chat, {
          document: bytes,
          mimetype: "application/json",
          fileName: `tomate-respaldo-${new Date().toISOString().slice(0, 10)}.json`,
          caption: `🍅 Respaldo del ${fecha()}`
        });
        return true;
      } catch (error) {
        return reply(`🍅 No pude respaldar: ${recortar(error.message, 160)}`);
      }
    }
  },
  {
    name: "savefile",
    aliases: ["guardar"],
    category: "owner",
    desc: "Guarda el archivo citado en la carpeta media/.",
    owner: true,
    run: async ({ reply, descargar, msg }) => {
      if (!msg.quoted?.quotedMessage) return reply("🍅 Cita un archivo (imagen, vídeo, audio o documento).");
      try {
        const bytes = await descargar();
        fs.mkdirSync(path.join(RAIZ, "media"), { recursive: true });
        const nombre = `media/${Date.now()}.bin`;
        fs.writeFileSync(path.join(RAIZ, nombre), bytes);
        return reply(`🍅 Guardado en *${nombre}* (${bytes.length} bytes).`);
      } catch (error) {
        return reply(`🍅 No pude guardarlo: ${recortar(error.message, 160)}`);
      }
    }
  },
  {
    name: "codemod",
    aliases: ["crearplugin"],
    category: "owner",
    desc: "Crea un plugin nuevo escribiéndolo por chat. Se comprueba antes de activarlo.",
    usage: "<archivo.js> <código>",
    owner: true,
    run: async ({ reply, args, text, msg }) => {
      const nombre = (args[0] || "").replace(/[^a-zA-Z0-9_-]/g, "");
      const codigo = text.slice(args[0]?.length || 0).trim();
      if (!nombre || !codigo) return reply("🍅 Uso: .codemod miplugin.js <código del plugin>");
      const destino = path.join(RAIZ, "plugins", nombre.endsWith(".js") ? nombre : `${nombre}.js`);
      console.log(`[codemod] ${msg.numero} escribió ${path.basename(destino)}`);
      const temporal = `${destino}.nuevo`;
      try {
        fs.writeFileSync(temporal, codigo, "utf8");
        // Se comprueba la sintaxis antes de pisar el archivo bueno.
        const revision = await correr(process.execPath, ["--check", temporal]);
        if (revision.codigo !== 0) {
          fs.rmSync(temporal, { force: true });
          return reply(`🍅 No compila, no lo guardé:\n${recortar(revision.salida, 600)}`);
        }
        fs.renameSync(temporal, destino);
        const recarga = typeof globalThis.__tomateRecargar === "function"
          ? await globalThis.__tomateRecargar()
          : null;
        return reply(
          `🍅 Guardado plugins/${path.basename(destino)}.` +
            (recarga ? ` Recargados *${recarga.lista.length}* comandos.` : " Reinicia para verlo.")
        );
      } catch (error) {
        try { fs.rmSync(temporal, { force: true }); } catch { /* nada que limpiar */ }
        return reply(`🍅 No pude guardarlo: ${recortar(error.message, 200)}`);
      }
    }
  },
  {
    name: "saveper",
    aliases: ["guardarper"],
    category: "owner",
    desc: "Fuerza el guardado de la base y dice cuánto ocupa.",
    owner: true,
    run: async ({ reply, store }) => {
      store.guardarAhora();
      const archivo = path.join(config.rutas.datos, "tomate.json");
      try {
        const info = fs.statSync(archivo);
        return reply(
          `🍅 Base guardada: *${(info.size / 1024).toFixed(0)} KB* · ` +
            `*${Object.keys(store.datos.usuarios).length}* usuarios · ` +
            `modificada ${fecha(info.mtimeMs)}`
        );
      } catch {
        return reply("🍅 Guardado, pero no encontré el archivo para medirlo.");
      }
    }
  },
  {
    name: "detectar",
    aliases: ["detectarsistema"],
    category: "owner",
    desc: "Lo que el bot sabe de quien escribe o del citado (nada inventado).",
    owner: true,
    run: async ({ reply, msg, sock }) => {
      const quien = msg.quoted?.participant || msg.sender;
      return reply(
        `🍅 *Datos que el bot tiene de verdad*\n\n` +
          `· JID: \`${quien}\`\n` +
          `· Número: *${nombreCorto(quien)}*\n` +
          `· En grupo: *${msg.isGroup ? "sí" : "no"}*\n` +
          `· Administrador: *${msg.isGroup ? "se mira en el grupo" : "no aplica"}*\n` +
          `· Mensaje: *${msg.mediaType || "texto"}*\n` +
          `· Bot: *${sock.user?.name || "—"}* (${nombreCorto(sock.user?.["id"])})`
      );
    }
  },
  {
    name: "setcmd",
    aliases: ["prefix"],
    category: "owner",
    desc: "Cambia los prefijos de comandos en caliente.",
    usage: "<prefijos>",
    owner: true,
    run: async ({ reply, text }) => {
      const nuevos = [...text.trim()].filter((c) => !/\s/.test(c));
      if (!nuevos.length) return reply(`🍅 Prefijos actuales: *${config.prefijos.join(" ")}*`);
      config.prefijos = nuevos;
      return reply(`🍅 Prefijos: *${nuevos.join(" ")}*`);
    }
  },
  {
    name: "updategithub",
    aliases: ["update", "pull"],
    category: "owner",
    desc: "Trae los cambios del repositorio (git pull).",
    owner: true,
    run: async ({ reply }) => {
      if (!fs.existsSync(path.join(RAIZ, ".git"))) return reply("🍅 Esta copia no es un repositorio git.");
      const { codigo, salida } = await correr("git", ["pull", "--ff-only"]);
      if (codigo !== 0) return reply(`🍅 git pull falló:\n${recortar(salida, 800)}`);
      return reply(`🍅 Actualizado. Reinicia con .restart para aplicar.\n\n${recortar(salida, 600)}`);
    }
  },
  {
    name: "gclone",
    aliases: ["gitclone"],
    category: "owner",
    desc: "Cuenta los archivos de un repositorio ya clonado (sin ejecutar nada del repo).",
    usage: "<url>",
    owner: true,
    run: async ({ reply, text }) => {
      if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+/.test(text)) {
        return reply("🍅 Pásame una URL de GitHub: https://github.com/usuario/repo");
      }
      return reply(
        "🍅 Por seguridad el bot no clona ni ejecuta repositorios ajenos.\n" +
          "Si lo necesitas, clónalo a mano en el servidor y reinicia."
      );
    }
  }
];
