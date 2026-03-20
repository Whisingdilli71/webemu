# WebEmu

## PLAY TESTING ROM IS PROVIDED IN GBA AND NES CONSOLES AS WELL AS GENESIS AND SNES, PLEASE CLICK THE URL BOX AND A URL WILL SPAWN 

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Hack Club](https://img.shields.io/badge/Hack_Club-%23EC3750.svg?style=flat&logo=Hack-Club&logoColor=white)](https://hackclub.com/)
[![Netlify](https://img.shields.io/badge/deployed%20on-Netlify-00C7B7)](https://netlify.com)
[![Nostalgist.js](https://img.shields.io/badge/nostalgist.js.org-F7DF1E?style=for-the-badge&logo=JavaScript&logoColor=black)](https://nostalgist.js.org)
[![libretro](https://img.shields.io/badge/cores-libretro-orange)](https://github.com/libretro)

Browser-based retro emulator. Drop a ROM and play. No installs, no accounts, no plugins.

**Live Demo:** [webemu.whising.space](https://webemu.whising.space)

## Features

- 10 systems across two emulation backends
- Personal game collection with Google and email sign-in
- Folder import, you can scan an entire ROM folder at once
- Automatic cover art via libretro-thumbnails with manual rescan and custom image upload
- Save states and load states
- Rewind and fast forward
- Volume control via Web Audio API
- Dark mode and 4 additional themes
- Drag and drop ROM loading or URL input
- Controller support out of the box
- Vanilla JS and CSS, no frameworks

## Systems

| System | Backend | Core |
|---|---|---|
| NES / Famicom | Nostalgist.js | fceumm |
| Super NES / Super Famicom | Nostalgist.js | snes9x |
| Game Boy / GBC / GBA | Nostalgist.js | mGBA |
| Game & Watch | Nostalgist.js | gw |
| Genesis / Mega Drive | Nostalgist.js | genesis_plus_gx |
| Game Gear | Nostalgist.js | genesis_plus_gx |
| PlayStation | EmulatorJS | pcsx_rearmed |
| PSP | EmulatorJS | PPSSPP |
| Nintendo 64 | EmulatorJS | mupen64plus |
| Nintendo DS | EmulatorJS | melonDS |

## How it works

Nostalgist.js wraps libretro cores compiled to WebAssembly via Emscripten for the classic systems. EmulatorJS handles the heavier ones, PlayStation, PSP, N64, and DS. Cover art is fetched from the libretro-thumbnails CDN on jsDelivr. ROMs in the collection are stored in IndexedDB locally on your device and never leave it. Game metadata syncs to Firebase Firestore per account.

## Getting Started
```bash
git clone https://github.com/Whisingdilli71/webemu.git
cd webemu
open index.html
```

No build step. Open `index.html` in any modern browser.

For PSP and N64, SharedArrayBuffer headers are required. Run locally with:
```bash
npx serve . --config serve.json
```

With a `serve.json` containing COOP and COEP headers. On Netlify, add a `netlify.toml` with the same headers. I have provided the one I have used. And in serve.json, use the same headers IF you want to use locally.

## Star the repo

If you found this useful, a star helps a lot.

⭐ [Star WebEmu on GitHub](https://github.com/Whisingdilli71/webemu)
