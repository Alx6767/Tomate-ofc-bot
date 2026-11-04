# 🔐 Seguridad de Tomate ofc bot

Este documento dice **qué está protegido, cómo, y qué sigue siendo riesgo** si lo
usas mal. Está escrito para que puedas revisarlo antes de encender el bot en un
grupo grande.

---

## 1. Lo que un desconocido puede llegar a tocar

| Riesgo | Estado | Cómo está resuelto |
|---|---|---|
| Ejecutar código por la calculadora | ❌ cerrado | `src/calc.js` interpreta la expresión con su propio analizador; no hay `eval` ni `new Function` |
| Ejecutar código por `.eval` | ⚠️ abierto **solo al dueño** | `owner: true`, cada uso se escribe en la consola; borra `plugins/owner.js` y desaparece |
| Clonar repositorios | ❌ cerrado | `gitclone` no clona: responde que está desactivado |
| Inyectar comandos de shell | ❌ cerrado | todo se lanza con `spawn(programa, [args])`, nunca con una cadena de shell |
| Leer archivos del servidor | ⚠️ solo dueño | `savefile`/`backup` son `owner: true` y trabajan dentro de la carpeta del bot |
| Contenido adulto | ❌ apagado | `NSFW=false` por defecto; los comandos además lo comprueban uno por uno |
| Spam y flood | ✅ limitado | `RATE_LIMIT` por chat y minuto, más cooldown por comando |
| Enlaces de invitación | ✅ filtro | `ANTI_LINK` global y `.antinu` por grupo; solo borran si el bot es admin |
| Robo de sesión | ✅ fuera del repo | `sesion/` está en `.gitignore` y no se sube nunca |

## 2. Comandos de dueño

Estos solo los puede usar el número que esté en `OWNER`, o el propio teléfono del
bot (`fromMe`):

```
eval  codemod  r  restart  backup  savefile  saveper  setcmd  updategithub  getcode  subbot  delbot
```

Si alguien más los escribe, el bot responde «Comando restringido: solo el dueño»
y no ejecuta nada. La comprobación se hace **antes** de mirar argumentos.

## 3. `eval`: por qué sigue existiendo

En el teléfono, cuando algo falla, no hay depurador. `eval` es la forma rápida de
mirar el estado del bot. Las condiciones para que se quede:

1. Solo el dueño.
2. Cada uso queda escrito en la consola con el número que lo escribió.
3. Se puede borrar: elimina `plugins/owner.js`, reinicia, y el comando ya no
   existe ni aparece en el menú.

Si vas a tener el bot en un grupo público, bórralo. No hace falta para nada más.

## 4. Descargas y programas externos

- `yt-dlp` y `ffmpeg` se detectan en tiempo de ejecución (`hayYtdlp()`,
  `hayFfmpeg()`). Si faltan, el comando lo dice; no se finge la respuesta.
- Las URLs se pasan como **un argumento** de `spawn`, así que una URL con `;`,
  `$()` o comillas no se interpreta como orden de shell.
- Hay tope de tamaño (`60 MB` en `src/ytdlp.js`) y se limpian los temporales.

## 5. Base de datos

- Un solo JSON (`data/tomate.json`), guardado con escritura atómica (archivo
  temporal + `rename`).
- Si el archivo se corrompe, **no se borra**: se aparta como
  `tomate.json.corrupto-<fecha>.json` y el bot arranca vacío avisando en consola.
- Los cooldowns y las siembras se guardan dentro del usuario, así que sobreviven
  a un reinicio (no se pueden burlar reiniciando el bot).

## 6. Lo que sigue siendo tu responsabilidad

- **Quién es `OWNER`.** Si pones ahí un número que no controlas, esa persona
  puede hacer todo lo de la sección 2.
- **El grupo donde lo pongas.** El bot no verifica edades ni contenido; `NSFW`
  lo enciendes tú y respondes por eso.
- **El hosting.** En planes gratuitos el disco se borra y hay que revincular; no
  es un fallo del bot.
- **Las claves de IA.** Van en `.env`, que está ignorado por git. No las pegues
  en el chat ni en capturas.

## 7. Cómo revisar esto tú mismo

```bash
npm test            # 58 pruebas, incluye permisos y comandos bloqueados
npm run check       # sintaxis de todos los archivos
grep -rn "eval\|new Function" src/ plugins/    # verás solo plugins/owner.js
grep -rn "exec(\|shell: true" src/ plugins/    # no debe haber nada
```

Si algo de esto falla, no es que el documento esté mal: es que el código cambió
y hay que volver a mirarlo.
