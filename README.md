<div align="center">

<img src="assets/mascota.png" alt="Tomate ofc bot" width="170">

# 🍅 Tomate ofc bot

**Un bot de WhatsApp completo, escrito desde cero, con más de 200 comandos.**

[![Versión](https://img.shields.io/badge/versión-1.0.0-e63946?style=for-the-badge)](package.json)
[![Node](https://img.shields.io/badge/node-%3E%3D%2020-3c873a?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Baileys](https://img.shields.io/badge/baileys-6.7-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://github.com/WhiskeySockets/Baileys)
[![Comandos](https://img.shields.io/badge/comandos-219-1d3557?style=for-the-badge)](docs/COMANDOS.md)
[![Pruebas](https://img.shields.io/badge/pruebas-58%20%2F%2058-2a9d8f?style=for-the-badge)](test/)
[![Licencia](https://img.shields.io/badge/licencia-MIT-f4a261?style=for-the-badge)](LICENSE)

[Guía completa](docs/GUIA.md) · [Comandos](docs/COMANDOS.md) · [Instalación](#-instalación) · [Configuración](#-configuración) · [Despliegue](#-despliegue) · [Plugins](#-cómo-se-hace-un-plugin) · [Problemas](#-problemas-frecuentes)

</div>

---

## 🍅 Qué es esto

Tomate ofc bot es un bot de WhatsApp hecho en JavaScript (ESM) sobre
[Baileys](https://github.com/WhiskeySockets/Baileys). No es un fork de otro bot:
está escrito pieza por pieza, con plugins que se cargan solos y un menú que se
arma con los comandos que existan de verdad en la carpeta `plugins/`.

- **219 comandos** repartidos en 16 categorías: economía y RPG, juegos, perfil,
  administración de grupos, descargas, gacha, pokémon, IA, minijuegos de texto,
  álbum, utilidades y comandos de dueño.
- **Sin base de datos que compilar**: todo se guarda en un JSON, así funciona en
  Termux y en cualquier hosting sin instalar SQLite.
- **Plugins sueltos**: un archivo = una lista de comandos. Si un plugin tiene un
  error, el bot avisa cuál es y sigue funcionando con el resto.
- **Descargas que funcionan también en servidor**: `.play` no depende solo de
  yt-dlp. Busca con `yt-search` y prueba tres fuentes en orden hasta que una
  entregue el archivo de verdad (audio o vídeo comprobado, no un enlace roto).
- **Botones nativos** de WhatsApp en los comandos que lo merecen, con respaldo
  automático a texto si el cliente del que recibe no los acepta.
- **Nada de promesas falsas**: si falta ffmpeg o la clave de una IA, el comando
  lo dice y explica cómo instalarlo. No simula respuestas.
- **58 pruebas automáticas** que ejecutan los comandos contra un WhatsApp falso.

<div align="center">
<img src="assets/banner.jpg" alt="Banner" width="620">
</div>

---

## 📦 Requisitos

| Cosa | Mínimo | Nota |
|---|---|---|
| Node.js | 20 | `node -v` para comprobarlo |
| npm | 9 | viene con Node |
| ffmpeg | opcional | stickers, notas de voz y conversiones |
| yt-dlp | opcional | `play`, `play2`, `ytinfo`, `tiktok`… |
| Un número de WhatsApp | — | puede ser un número nuevo |

Sin ffmpeg ni yt-dlp el bot funciona igual: solo esos comandos avisan de que
faltan y te dicen cómo instalarlos.

---

## 🚀 Instalación

### En Termux (Android)

```bash
pkg update && pkg upgrade -y
pkg install nodejs git ffmpeg python -y
git clone https://github.com/Alx6767/Tomate-ofc-bot.git
cd Tomate-ofc-bot
npm install
cp .env.example .env
nano .env          # pon tu número en OWNER
npm start
```

`yt-dlp` en Termux se instala aparte, y es lo que hace falta para las descargas:

```bash
pkg install python pip -y
pip install -U yt-dlp
```

### En una PC con Linux

```bash
sudo apt update
sudo apt install nodejs npm git ffmpeg -y
git clone https://github.com/Alx6767/Tomate-ofc-bot.git
cd Tomate-ofc-bot
npm install
cp .env.example .env
npm start
```

### En Windows

Instala Node.js desde [nodejs.org](https://nodejs.org), luego:

```powershell
git clone https://github.com/Alx6767/Tomate-ofc-bot.git
cd Tomate-ofc-bot
npm install
copy .env.example .env
npm start
```

---

## 🔗 Vincular el número

Al arrancar por primera vez el bot pide la vinculación. Hay dos formas, y se
elige con `PAIRING` en el `.env`.

**Código QR** (por defecto):

```
PAIRING=qr
```

Sale un QR en la consola. En el teléfono: **WhatsApp → Ajustes → Dispositivos
vinculados → Vincular un dispositivo** y escanéalo.

**Código de 8 caracteres**:

```
PAIRING=code
PAIRING_NUMBER=5215512345678
```

El bot imprime un código como `ABCD-1234`. En el teléfono, en la misma pantalla
de dispositivos vinculados, elige **Vincular con número de teléfono** y escríbelo.

La sesión queda en `sesion/`. Si el bot se reinicia no hay que volver a
vincular; si quieres desvincular, borra esa carpeta y arranca otra vez.

> ⚠️ `sesion/` son las credenciales del número. Está en `.gitignore` y no debe
> subirse nunca a ningún sitio.

---

## ⚙️ Configuración

Todo va en `.env` (copia de `.env.example`). Lo esencial:

| Variable | Para qué | Por defecto |
|---|---|---|
| `OWNER` | tu número; único con comandos de dueño | vacío |
| `MODS` | otros números con permisos suaves | vacío |
| `BOT_NAME` | nombre en el menú | `Tomate ofc bot` |
| `BOT_EMOJI` | emoji del marchamo | `🍅` |
| `PREFIXES` | prefijos aceptados | `.,!,/` |
| `PAIRING` | `qr` o `code` | `qr` |
| `PAIRING_NUMBER` | número a vincular con `code` | vacío |
| `COUNTRY` | completa números locales de 10 dígitos | `MX` |
| `TZ` | zona horaria de hora y clima | `America/Mexico_City` |
| `PRIVATE_MODE` | solo el dueño y mods usan el bot | `false` |
| `ANTI_LINK` | borrar enlaces de grupo | `true` |
| `NSFW` | comandos de adultos | `false` |
| `RATE_LIMIT` | comandos por minuto y chat (`0` = sin límite) | `25` |
| `GEMINI_KEY` | clave de Google Gemini | vacío |
| `GROQ_KEY` | clave de Groq | vacío |
| `OPENAI_KEY` | clave de OpenAI | vacío |

### Claves de IA (opcional)

Cada comando de IA usa un proveedor distinto:

| Comando | Proveedor | Dónde sacar la clave |
|---|---|---|
| `.gemini` | Google AI Studio | https://aistudio.google.com/apikey |
| `.iasaurio` | Groq | https://console.groq.com/keys |
| `.chatgpt` | OpenAI | https://platform.openai.com/api-keys |

`.simi` usa el que esté configurado, en ese orden. `.reset` borra el hilo de
conversación del chat. Sin claves, los comandos responden que falta la clave y
cómo ponerla: no hay respuestas inventadas.

---

## ☁️ Despliegue

### Railway / Render / Koyeb

1. Sube el proyecto a un repositorio.
2. Crea el servicio apuntando a ese repositorio.
3. Comando de arranque: `npm start`.
4. Añade las variables de entorno de la tabla de arriba.
5. Para el QR: abre los **logs** del servicio y escanea el código desde ahí.

> En estos hostings el disco se borra al reiniciar. Si no quieres volver a
> vincular cada vez, usa `PAIRING=code` o monta un volumen en `sesion/` y `data/`.

### VPS con systemd

```ini
# /etc/systemd/system/tomate.service
[Unit]
Description=Tomate ofc bot
After=network-online.target

[Service]
Type=simple
WorkingDirectory=/root/Tomate-ofc-bot
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tomate
sudo journalctl -u tomate -f     # ver los logs y el QR
```

### PM2

```bash
npm install -g pm2
pm2 start index.js --name tomate
pm2 logs tomate
pm2 save && pm2 startup
```

---

## 🗂️ Cómo está armado

```
Tomate-ofc-bot/
├── index.js              arranque, conexión, reconexión y vinculación
├── src/
│   ├── config.js         lee el .env y expone `config`
│   ├── logger.js         mensajes de consola con color
│   ├── store.js          base de datos en un JSON, con guardado diferido
│   ├── utils.js          helpers: números, monedas, fechas, descargas
│   ├── loader.js         descubre y valida los plugins
│   ├── menu.js           arma el menú con los comandos reales
│   ├── handler.js        recibe el mensaje, aplica permisos y ejecuta
│   ├── media.js          stickers, notas de voz, conversiones (ffmpeg)
│   ├── ytdlp.js          descargas con yt-dlp (opcional, se detecta)
│   ├── ia.js             proveedores de IA e historial por chat
│   ├── calc.js           calculadora sin eval, con analizador propio
│   ├── extra.js          funciones de apoyo
│   └── subbots.js        otras cuentas conectadas desde el mismo proceso
├── plugins/              los comandos, uno o varios por archivo
├── data/                 catálogo del gacha y la base `tomate.json`
├── assets/               mascota y banner
├── test/                 pruebas automáticas
├── tools/                utilidades (`npm run menu`)
└── docs/                 guía de seguridad y lista de comandos
```

### Cómo se hace un plugin

Crea un archivo en `plugins/` y exporta una lista de comandos. No hay que
registrar nada en ningún otro sitio: se carga solo al arrancar.

```js
export default [
  {
    name: "saludo",
    aliases: ["hola"],
    category: "utils",
    desc: "Saluda.",
    usage: "[nombre]",
    run: async ({ reply, text }) => {
      return reply(`🍅 Hola ${text || "mundo"}.`);
    }
  }
];
```

Lo que recibe `run`:

| Campo | Qué es |
|---|---|
| `reply(texto)` | responde citando el mensaje |
| `send(jid, contenido)` | manda algo a cualquier chat |
| `react(emoji)` | reacciona al mensaje |
| `descargar(tipo)` | baja el archivo citado (`image`, `video`, `audio`) |
| `args`, `text` | argumentos separados y el texto completo |
| `msg` | datos del mensaje: autor, chat, si es grupo, citado… |
| `store` | base de datos (`store.usuario(jid)`, `store.sumarCoins`…) |
| `isOwner`, `isAdmin`, `isBotAdmin` | permisos ya comprobados |
| `sock` | el socket de Baileys, para cosas avanzadas |

Banderas útiles: `owner: true` (solo dueño), `admin: true` (solo admins),
`group: true` (solo grupos), `botAdmin: true` (el bot debe ser admin),
`nsfw: true` (exige `NSFW=true`), `cooldown: 10` (segundos entre usos).

---

## 🧪 Pruebas

```bash
npm test          # 58 pruebas
npm run menu      # pinta el menú en la consola, sin conectar WhatsApp
npm run check     # revisa la sintaxis de todos los archivos
```

Las pruebas cubren la calculadora, los helpers, la base de datos, la carga de
plugins, el menú, los permisos y el camino completo de un mensaje: prefijo,
comando, cooldown y respuesta.

---

## 🔐 Seguridad

- La calculadora **no usa `eval`**: tiene su propio analizador. Así un mensaje
  no puede ejecutar código.
- `eval`, `codemod`, `savefile`, `backup` y compañía son **solo del dueño**.
- Los programas externos se lanzan con `spawn` y argumentos separados, nunca con
  una cadena de shell.
- `gitclone` **no clona** repositorios ajenos: responde que está desactivado.
- Los comandos de adultos están apagados por defecto.

Detalles en [docs/SEGURIDAD.md](docs/SEGURIDAD.md).

---

## ❓ Problemas frecuentes

**«No conecta y vuelve a pedir QR»**
La sesión no se guardó: revisa que la carpeta `sesion/` exista y tenga permisos
de escritura. En hostings sin disco persistente pasa siempre.

**«Error 429 / rate-overlimit al vincular»**
WhatsApp limita los intentos. Espera entre 15 y 40 minutos antes de reintentar;
insistir alarga el bloqueo.

**«play dice que falta yt-dlp»**
Instálalo (`pip install -U yt-dlp`) o desde tu panel de hosting. Sin él, las
descargas no funcionan, y el bot no va a fingir que sí.

**«Los stickers no salen»**
Hace falta ffmpeg: `pkg install ffmpeg` en Termux, `sudo apt install ffmpeg` en
Linux.

**«Se reinicia solo»**
Mira la consola. El bot reintenta con esperas progresivas; si el error se repite,
suele ser la sesión corrupta: bórrala y vuelve a vincular.

---

## 🍅 Créditos

- Hecho por **riokuroxi-svg**.
- Se apoya en [Baileys](https://github.com/WhiskeySockets/Baileys), el motor de
  WhatsApp para Node.
- Datos de pokémon de [PokéAPI](https://pokeapi.co).
- Traducciones de [MyMemory](https://mymemory.translated.net).

## 📄 Licencia

MIT — mira [LICENSE](LICENSE). Úsalo, cámbialo y súbelo con tu nombre si quieres.

<div align="center">

**🍅 Si te sirvió, deja una estrella.**

</div>
