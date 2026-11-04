# 🍅 Guía de Tomate ofc bot

Manual de uso, de principio a fin. Si es la primera vez que lo instalas, esta es
la página que hay que leer: aquí está cómo arrancarlo, cómo se vincula el
número, qué hace cada cosa y qué hacer cuando algo falla.

---

## Índice

1. [Qué es y qué necesitas](#1-qué-es-y-qué-necesitas)
2. [Instalación](#2-instalación)
3. [Vincular el número](#3-vincular-el-número)
4. [Primeros pasos](#4-primeros-pasos)
5. [Cómo se usan los comandos](#5-cómo-se-usan-los-comandos)
6. [Permisos: quién puede hacer qué](#6-permisos-quién-puede-hacer-qué)
7. [Botones](#7-botones)
8. [Descargas explicadas](#8-descargas-explicadas)
9. [Economía y RPG](#9-economía-y-rpg)
10. [Gacha, pokémon y álbum](#10-gacha-pokémon-y-álbum)
11. [Juegos](#11-juegos)
12. [Administración de grupos](#12-administración-de-grupos)
13. [Sub-bots](#13-sub-bots)
14. [Inteligencia artificial](#14-inteligencia-artificial)
15. [Los datos y las copias de seguridad](#15-los-datos-y-las-copias-de-seguridad)
16. [Problemas frecuentes](#16-problemas-frecuentes)
17. [Mantenerlo actualizado](#17-mantenerlo-actualizado)
18. [Hacer tus propios comandos](#18-hacer-tus-propios-comandos)

---

## 1. Qué es y qué necesitas

Tomate ofc bot es un bot de WhatsApp escrito en JavaScript sobre Baileys.
Atiende un número de WhatsApp y responde a los comandos que empiezan por `.`,
`!` o `/`.

**Lo mínimo para que funcione:**

| Cosa | Hace falta | Para qué |
|---|---|---|
| Node.js 20 o más | sí | el bot está escrito en JavaScript moderno |
| npm | sí | instala las librerías |
| Un número de WhatsApp | sí | es la cara del bot |
| ffmpeg | no | stickers, notas de voz, conversión de archivos |
| yt-dlp | no | descargas de TikTok, Instagram, Facebook, Pinterest |

Sin ffmpeg ni yt-dlp el bot **arranca y funciona**; solo esos comandos avisan de
que les falta su herramienta y explican cómo instalarla.

**Dónde puede vivir:** en un teléfono con Termux, en una PC con Linux o Windows,
en un VPS, o en un hosting como Railway, Render o Koyeb.

---

## 2. Instalación

### Termux (Android)

```bash
pkg update && pkg upgrade -y
pkg install nodejs git ffmpeg python -y
git clone https://github.com/Alx6767/Tomate-ofc-bot.git
cd Tomate-ofc-bot
npm install
cp .env.example .env
nano .env
npm start
```

En `nano`, cambia la línea `OWNER=` y pon tu número con código de país, sin `+`,
sin espacios y sin guiones:

```
OWNER=5215512345678
```

Para guardar en `nano`: `Ctrl+O`, `Enter`, y `Ctrl+X` para salir.

### PC con Linux (Debian/Ubuntu)

```bash
sudo apt update
sudo apt install nodejs npm git ffmpeg -y
git clone https://github.com/Alx6767/Tomate-ofc-bot.git
cd Tomate-ofc-bot
npm install
cp .env.example .env
nano .env
npm start
```

### Windows

1. Instala Node.js desde [nodejs.org](https://nodejs.org) (versión LTS).
2. Abre **PowerShell** y ejecuta:

```powershell
git clone https://github.com/Alx6767/Tomate-ofc-bot.git
cd Tomate-ofc-bot
npm install
copy .env.example .env
notepad .env
npm start
```

### Qué pasa al arrancar

Vas a ver algo así:

```
   🍅  Tomate ofc bot
   ─────────────────────────────────────────
06:04:28 ✓ 219 comandos cargados en 16 categorías
06:04:28 · Escanea este QR desde WhatsApp → Dispositivos vinculados:
```

Si aparece «_plugin con problemas_», ese archivo tiene un error y el bot lo
saltó: el resto sigue funcionando. El mensaje dice cuál es y por qué.

---

## 3. Vincular el número

Hay dos formas. Se elige en `.env` con la variable `PAIRING`.

### Con QR (por defecto)

```
PAIRING=qr
```

Al arrancar sale un bloque de cuadros en la consola: ese es el QR. En el
teléfono:

**WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo** →
escanea el código de la pantalla.

Si tarda, el QR se renueva solo. Escanea el más reciente.

### Con código de 8 caracteres

Sirve cuando no puedes escanear (por ejemplo, si el bot corre en un servidor y
solo ves los logs en el móvil).

```
PAIRING=code
PAIRING_NUMBER=5215512345678
```

El bot imprime algo como `ABCD-1234`. En el teléfono, en la misma pantalla de
dispositivos vinculados, elige **Vincular con número de teléfono** y escríbelo.

### Dónde queda la sesión

En la carpeta `sesion/`. Ahí están las credenciales del número: **no se comparte,
no se sube a git, no se manda a nadie**. Ya está en `.gitignore`.

Si quieres desvincular: borra la carpeta y arranca otra vez.

```bash
rm -rf sesion
npm start
```

---

## 4. Primeros pasos

Con el bot ya conectado, desde tu propio WhatsApp:

1. Mándate un mensaje al bot o escríbele desde otro número: **`.ping`**.
   Si responde «Pong», está vivo.
2. **`.menu`** para ver todos los comandos agrupados por categoría.
3. **`.help bal`** para ver cómo se usa un comando concreto.
4. **`.botinfo`** para ver la versión, los comandos cargados y el tiempo activo.
5. **`.daily`** para empezar a juntar tomates.

---

## 5. Cómo se usan los comandos

Un comando se escribe así:

```
.prefijo + nombre + argumentos
```

Ejemplos reales:

| Escribes | Qué pasa |
|---|---|
| `.ping` | responde la latencia |
| `.play me atrapaste` | busca la canción y manda el audio |
| `.calc (12+8)*3` | devuelve `60` |
| `.kick 5215512345678` | saca a ese número del grupo (necesitas ser admin) |
| `.perfil` | tu ficha; `.perfil` citando a alguien muestra la suya |

Los tres prefijos hacen lo mismo: `.ping`, `!ping` y `/ping` son idénticos.

**Alias:** muchos comandos tienen nombres alternativos. `.play` también responde
a `.yt` y `.musica`. La lista completa está en [COMANDOS.md](COMANDOS.md).

**Mayúsculas:** da igual. `.PLAY` y `.play` son lo mismo.

---

## 6. Permisos: quién puede hacer qué

Hay cuatro niveles, y se comprueban **antes** de ejecutar nada:

| Nivel | Quién es | Qué puede hacer |
|---|---|---|
| Dueño | el número de `OWNER` en el `.env`, o el propio teléfono del bot | todo, incluidos `eval`, `backup`, `restart` |
| Moderador | los números de `MODS` | comandos suaves de administración |
| Administrador | quien sea admin del grupo | `kick`, `warn`, `close`, `antilink`… |
| Cualquiera | todos | economía, juegos, perfil, descargas, info |

Si alguien sin permiso intenta un comando restringido, el bot responde
«Comando restringido» y no ejecuta nada.

Extra:

- **`.private on`** con `PRIVATE_MODE=true` en el `.env`: solo el dueño y los
  moderadores pueden usar el bot.
- **`RATE_LIMIT`**: máximo de comandos por minuto y por chat. Frena a quien
  intenta saturar el bot.
- **Cooldown por comando**: `daily`, `work`, `crimen`… tienen su propia espera.

---

## 7. Botones

Algunos comandos mandan **botones nativos** de WhatsApp en vez de texto:

- `.play` → ficha del vídeo con «🎧 Bajar audio», «🎬 Bajar vídeo» y «🔗 Abrir en YouTube».
- `.yts` → lo mismo, pero solo la búsqueda con los botones.
- `.boton` → un ejemplo de cada tipo: respuesta, enlace y copiar.

Los tres tipos que se usan:

| Tipo | Qué hace al tocarlo |
|---|---|
| respuesta | manda un comando al chat, como si lo hubieras escrito |
| enlace | abre una página |
| copiar | copia un texto al portapapeles |

**Importante:** los botones dependen de la versión de WhatsApp de quien los
recibe. Si el cliente no los acepta, el bot **no se queda colgado**: manda el
mismo contenido como texto numerado y tú escribes el comando. Se puede apagar
todo con `BOTONES=false` en el `.env`.

---

## 8. Descargas explicadas

Esta es la parte que más problemas da en otros bots, así que va con detalle.

### YouTube: `.play` y `.play2`

```
.play nombre de la canción        → audio (mp3)
.play https://youtu.be/xxxx       → audio desde un enlace
.play2 nombre del vídeo           → vídeo (mp4)
.ytinfo nombre o enlace           → datos, sin descargar nada
```

**Cómo funciona por dentro:** se busca con `yt-search`, y luego se pide el
archivo a tres fuentes en orden, hasta que una entregue algo que **pese y sea de
verdad** audio o vídeo:

1. `@vreden/youtube_scraper`
2. `btch-downloader`
3. `yt-dlp`, si está instalado

Cada intento se comprueba: si una fuente devuelve un enlace roto, un archivo de
2 KB o un HTML en vez de un mp3, se descarta y se pasa a la siguiente. El
mensaje final dice qué fuente lo entregó.

> **Por qué no se usa solo yt-dlp:** en un teléfono funciona bien, pero en un
> VPS o hosting, YouTube contesta *«Sign in to confirm you're not a bot»* y la
> descarga falla siempre, por mucho que yt-dlp esté actualizado. Por eso el bot
> prueba primero las fuentes por API y deja yt-dlp como último recurso.

**Límites:** 25 minutos de vídeo y 60 MB por archivo, para que WhatsApp no
rechace el envío.

### Otras redes: `.tiktok`, `.instagram`, `.facebook`, `.pinterest`

Estas usan yt-dlp. Si falta, el comando lo dice y te explica cómo instalarlo:

```bash
# Termux
pkg install python pip -y
pip install -U yt-dlp

# Linux
sudo apt install yt-dlp
```

### Búsquedas que el bot no hace (y por qué)

- `.igsearch` — Instagram pide sesión iniciada y su API es privada. Devuelve el
  enlace directo al perfil.
- `.tiktoksearch` — TikTok no tiene búsqueda pública. Devuelve el enlace y
  recuerda que `.tiktok <enlace>` sí descarga un vídeo concreto.

El bot no inventa resultados: si no puede, lo dice.

---

## 9. Economía y RPG

Todo el mundo empieza con 0 tomates 🍅.

### Ganar

| Comando | Qué hace |
|---|---|
| `.daily` | recompensa diaria |
| `.work` | trabajo con espera entre usos |
| `.minar`, `.pescar`, `.talar`, `.cazar`, `.correr`, `.granja`, `.cocinar` | oficios: dan tomates y a veces objetos |
| `.crimen` | más riesgo, más premio |
| `.robar @alguien` | intenta robarle a otra persona |
| `.plantar` / `.plantar cosechar` | siembra y recoge a los 5 minutos |
| `.trivia` / `.responder A` | pregunta con premio |

### Guardar y mover

| Comando | Qué hace |
|---|---|
| `.bal` | tu saldo (y `.bal @alguien` el de otra persona) |
| `.banco` | ver lo que tienes guardado |
| `.depositar 500` | pasar tomates al banco (no te los pueden robar) |
| `.retirar 500` | sacarlos |
| `.transferir @alguien 100` | mandarle tomates |
| `.baltop` | ranking de los más ricos |

### Nivel

Cada mensaje da experiencia. La curva es `nivel² × 100`: subir del 1 al 2 pide
100 puntos; del 5 al 6, 2500. `.nivel` muestra el tuyo, `.topnivel` el del grupo.

### Combate

`.entrenar` sube fuerza y defensa, `.einfo` mira tus estadísticas, `.enemigos`
lista rivales, `.atacar` pelea, `.curar` recupera vida, `.boss` y `.dungeon` son
retos con premio grande, `.duelo @alguien` y `.dueloaceptar` son peleas entre
personas, `.tienda` y `.comprar` venden armas y herramientas, `.craftear` las
fabrica con lo que juntes.

---

## 10. Gacha, pokémon y álbum

### Gacha

`.rollwaifu` saca un personaje al azar y tienes 30 segundos para reclamarlo con
`.claim`. `.harem` muestra tu colección, `.wshop` vende personajes por tomates y
`.vote` abre una votación del grupo.

El catálogo está en `data/personajes.json` y **se puede editar a mano**: cada
ficha lleva `id`, `nombre`, `serie`, `rareza` (1 a 5) y `precio`. Los personajes
que vienen son inventados a propósito.

### Pokémon

`.atrapar` gasta una pokébola y puede que atrapes uno; `.guardarpoke` lo pone en
tu equipo, `.caja` en el depósito. `.pokeshop` vende pokébolas, `.pokemon pikachu`
trae la ficha desde PokéAPI, `.pokebatalla @alguien` pelea con tu primer pokémon.

### Álbum

`.album` va juntando imágenes citadas y con `.album fin` las manda seguidas (así
WhatsApp las agrupa). `.atraparm` atrapa monstruos del huerto, `.misMonstruos`
los lista.

---

## 11. Juegos

### De chat

`.8ball`, `.dado`, `.moneda`, `.ppt`, `.ahorcado`, `.sorteo`, `.ship`,
`.parejas`, `.topgays`, `.reto`, `.verdad`, `.piropo`, `.chiste`, `.horoscopo`,
`.frase`, `.azar`, `.meme`, `.ruletarusa`, `.juicio`, `.culpable`, `.inocente`.

### De tablero, jugables de verdad

Estos se dibujan con emojis en el mensaje y responden a tus movimientos:

| Comando | Cómo se juega |
|---|---|
| `.snake` | abre la serpiente; mueve con `.snake arriba/abajo/izquierda/derecha` |
| `.pacman` | come los puntos sin que te atrape el fantasma |
| `.flappy` | `.flappy saltar` para pasar entre los tubos |
| `.tetris` | `.tetris izquierda/derecha/rotar/bajar` |
| `.pong` | devuelve con `.pong izquierda/centro/derecha` |
| `.sala21` | blackjack: `.sala21 pedir` o `.sala21 plantarse` |
| `.buscaminas` | `.buscaminas 2,3` para abrir una casilla |
| `.bunker`, `.joinpartida`, `.bunkervoto` | juego de roles para el grupo |
| `.carreracrear`, `.joincarrera`, `.iniciarb` | carrera de tomates |

Cada partida es de quien la abrió; si otra persona escribe en el mismo chat, el
bot le avisa. `.salirarcade` cierra las que tengas abiertas.

---

## 12. Administración de grupos

El bot tiene que ser **administrador** para las que tocan a otras personas.

| Comando | Qué hace |
|---|---|
| `.kick @x` / `.ban @x` | saca del grupo |
| `.promote @x` / `.demote @x` | da o quita administrador |
| `.warn @x` | aviso; al tercero, expulsa |
| `.warns` / `.delwarn @x` | ver avisos / borrarlos |
| `.close` / `.open` | cierra o abre el grupo para escribir |
| `.link` / `.resetlink` | enlace de invitación / regenerarlo |
| `.tag texto` | menciona a todos |
| `.del` | borra el mensaje que citas |
| `.antilink on` | borra enlaces de otros grupos |
| `.antinu on` | borra invitaciones y enlaces de canal |
| `.autoadmin on` | da administrador a quien entra |
| `.bienvenida on` | saluda a quien entra |
| `.mute 30` | silencia el grupo media hora |
| `.infogrupo` | datos del grupo |

Consejo: déjalo de administrador solo el tiempo necesario. Un bot con admin puede
echar a cualquiera, y eso es mucho poder para un archivo de configuración mal
puesto.

---

## 13. Sub-bots

Un sub-bot es **otra cuenta** conectada desde el mismo proceso. Sirve para
atender desde un número distinto sin abrir otra terminal.

```
.code 5215512345678     → crea el sub-bot y devuelve su código de 8 caracteres
.bots                   → los sub-bots activos
.delbot 5215512345678   → lo desconecta y borra su sesión
```

Cada sub-bot guarda su sesión en `sesion/sub-<número>/`. Viven mientras viva el
proceso: si reinicias el bot, hay que volver a arrancarlos con `.code`.

---

## 14. Inteligencia artificial

Opcional. Se activa poniendo una clave en el `.env`.

| Comando | Proveedor | Clave |
|---|---|---|
| `.gemini` | Google Gemini | `GEMINI_KEY` |
| `.iasaurio` | Groq | `GROQ_KEY` |
| `.chatgpt` | OpenAI | `OPENAI_KEY` |
| `.simi` | el que esté configurado | — |

- `.reset` borra el hilo de conversación de ese chat.
- Cada chat tiene su propia memoria (las últimas 8 vueltas).
- Sin clave, el comando responde que falta y dónde conseguirla. **No inventa
  respuestas ni finge que la IA contestó.**

---

## 15. Los datos y las copias de seguridad

Todo se guarda en **`data/tomate.json`**: usuarios, saldos, niveles, parejas,
personajes, avisos de grupo. Es un solo archivo a propósito, para que funcione
en Termux sin compilar una base de datos.

- Se guarda solo, con unos segundos de retraso y escritura atómica.
- Si el archivo se corrompe, **no se borra**: se aparta como
  `tomate.json.corrupto-<fecha>.json` y el bot arranca vacío avisando en consola.
- `.backup` (dueño) manda el JSON por WhatsApp como documento.
- `.saveper` (dueño) fuerza el guardado y dice cuánto ocupa.

**Copia de seguridad manual:**

```bash
cp data/tomate.json ~/tomate-$(date +%F).json
```

---

## 16. Problemas frecuentes

**Vuelve a pedir el QR cada vez que arranco**
La carpeta `sesion/` no se está guardando. Pasa en hostings con disco temporal.
Soluciones: montar un volumen en `sesion/`, usar `PAIRING=code`, o ponerlo en un
VPS.

**«Sign in to confirm you're not a bot» en las descargas**
Es YouTube bloqueando la IP del servidor. `.play` ya lo esquiva usando las
fuentes por API; si aun así falla, prueba `.play` otra vez (a veces una fuente
está caída) o pon el bot en un teléfono.

**`.play` no encuentra la canción**
Escribe el nombre más completo, o pega el enlace directamente desde YouTube.

**Los stickers no salen**
Falta ffmpeg: `pkg install ffmpeg` (Termux) o `sudo apt install ffmpeg` (Linux).

**Los botones no aparecen**
Es la versión de WhatsApp de quien los recibe. El bot manda el texto equivalente
con las opciones numeradas; escribe el comando que corresponde.

**Se reinicia solo**
Mira la consola. Si el error se repite y menciona la sesión, bórrala y vincula
otra vez. Si el teléfono está sin batería o sin internet, el bot espera y
reintenta con pausas más largas.

**Responde «Comando restringido»**
Ese comando es de dueño o de administrador y tu número no está en la lista.

**Se queda callado en un grupo**
Puede ser el límite de `RATE_LIMIT` (25 comandos por minuto y chat) o que el
comando tenga espera. Espera un momento y repite.

---

## 17. Mantenerlo actualizado

```bash
cd Tomate-ofc-bot
git pull
npm install
# reinicia el bot
```

Si tienes el bot en marcha, `.updategithub` (dueño) hace el `git pull` y avisa.
Después hay que reiniciar: `.restart` (dueño) o cerrar y volver a `npm start`.

`.r` recarga **solo los plugins** sin reiniciar: sirve cuando cambias un archivo
de `plugins/` y no quieres perder la sesión.

---

## 18. Hacer tus propios comandos

Un plugin es un archivo en `plugins/` que exporta una lista. No hay que
registrarlo en ningún sitio: el bot lo encuentra solo al arrancar.

```js
export default [
  {
    name: "saludo",
    aliases: ["hola"],
    category: "utils",
    desc: "Saluda.",
    run: async ({ reply }) => reply("🍅 Hola.")
  }
];
```

Comprueba que quedó bien sin reiniciar:

```bash
npm run menu      # pinta el menú: tu comando debe aparecer
npm test          # revisa que nada se rompió
```

Y si el archivo tiene un error de sintaxis, el bot lo dirá al arrancar y seguirá
con los demás.

Todo lo que recibe un comando está explicado en el
[README](../README.md#cómo-se-hace-un-plugin).

---

<div align="center">

**🍅 Dudas, fallos y mejoras: abre un issue en el repositorio.**

</div>
