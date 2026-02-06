---
name: electron-wrapper-for-music-player
overview: Wrap the existing Music web app (React/Vite) in an Electron shell to create a Windows desktop player with identical functionality and a custom music icon, packaged with an installer.
todos:
  - id: import-web-app
    content: Bring the existing Music React/Vite web app into a `web/` subfolder and ensure it runs standalone.
    status: completed
  - id: setup-electron-project
    content: Initialize root Electron project with package.json, dev scripts, and TypeScript support.
    status: completed
  - id: implement-main-and-preload
    content: Create Electron `main.ts` and `preload.ts` to host the web app in dev and production with secure settings.
    status: completed
  - id: configure-build-pipeline
    content: Set up scripts to build the web app and Electron app together, wiring prod `loadFile` to the built assets.
    status: completed
  - id: add-custom-icon-and-packaging
    content: Add a custom music `.ico` icon and configure electron-builder for a Windows installer with no default Electron branding.
    status: completed
  - id: document-and-test
    content: Write root README and smoke test all major music player features inside the built Electron app to confirm 1:1 behavior.
    status: completed
isProject: false
---

## Goal

Create a Windows Electron app that runs the existing Music web app 1:1 (same features, keyboard shortcuts, IndexedDB library, drag-and-drop, telemetry, etc.), with a **custom music app icon** instead of the default Electron icon, and a **production-ready installer build**.

## High-level approach

- **Reuse existing web app** from the upstream repo `[https://github.com/Jahbas/Music](https://github.com/Jahbas/Music)` as the renderer UI.
- **Add an Electron shell** in the `Music-electron` workspace that:
  - Runs the Vite dev server in development and loads it in a `BrowserWindow`.
  - Loads the built `dist` files in production.
  - Keeps Node APIs isolated from the renderer (no `nodeIntegration`) and uses a preload script for any future IPC.
- **Configure packaging (electron-builder)** for Windows-only:
  - Custom `.ico` app icon (no default Electron logo).
  - Single-click installer (e.g., NSIS) and proper app metadata.

## Project structure

- **Root (`Music-electron`)**
  - `package.json` with **Electron + electron-builder** devDependencies and scripts.
  - `electron/` folder (or `src-electron/`) containing:
    - `main.ts` (main process / app entry).
    - `preload.ts` (secure bridge for future native features, if needed).
  - `web/` folder containing the **Music web app** (cloned or copied from the GitHub repo), preserving its existing structure:
    - `web/package.json`, `web/vite.config.ts`, `web/src/**`, etc.
  - `build/icons/` or similar directory holding the **custom music icon** files (`.ico` for Windows, optionally `.png` sources).

## Detailed steps

### 1. Bring the web app into this workspace

- **Clone or copy** the `Music` repo into a `web/` subfolder inside `Music-electron`.
- Confirm the web app runs normally in isolation:
  - `cd web`
  - `npm install`
  - `npm run dev`
- Document this relationship in a short `README.md` at the root explaining that `web/` is the renderer and Electron lives in the root.

### 2. Initialize Electron in the root project

- Create a **root `package.json**` (if not already present) with:
  - `electron` (runtime), `electron-builder` (packaging), and TypeScript tooling.
  - Scripts such as:
    - `"dev": "concurrently \"cd web && npm run dev\" \"electron .\""` (or similar) so Electron opens the Vite dev server.
    - `"build:web": "cd web && npm run build"`.
    - `"build:electron": "electron-builder"`.
    - `"build": "npm run build:web && npm run build:electron"`.
- Set the Electron app entry to `electron/main.ts` (or `main.js` after build) via the `main` field in `package.json`.

### 3. Implement the Electron main process

- Add `electron/main.ts` with logic to:
  - Handle app lifecycle (`app.whenReady`, `window-all-closed`, `activate`).
  - Create a `BrowserWindow` with sensible defaults for a music player:
    - Reasonable default size and minimum size.
    - `webPreferences` with `contextIsolation: true`, `nodeIntegration: false`, `preload` pointing to `preload.js`.
  - **Dev vs production loading:**
    - In dev, `loadURL('http://localhost:5173')` (or the Vite port used by `web/`).
    - In production, `loadFile(path.join(__dirname, '../web/dist/index.html'))` (adjust to final build location).
- Wire up basic `BrowserWindow` events (focus, closed) and ensure single-instance behavior if desired (optional for v1).

### 4. Add a secure preload script

- Add `electron/preload.ts` with:
  - `contextBridge.exposeInMainWorld` to expose a small, typed API surface (even if initially empty) for future features.
  - No direct access to Node globals in the renderer.
- Set up TypeScript configuration (either a separate `tsconfig.electron.json` or include Electron sources in the root `tsconfig.json`) and adjust build scripts so Electron TypeScript is compiled to `dist-electron/`.

### 5. Preserve 1:1 web functionality

- Ensure the Electron window behaves like a regular Chromium tab:
  - No changes to the renderer code are required for **IndexedDB**, **localStorage**, **drag-and-drop of local audio files/folders**, **keyboard shortcuts**, and **routing** — these should all work unchanged inside Electron’s browser context.
- Confirm that **file and folder drops** onto the window are still delivered to the web app (Electron’s defaults allow this for the renderer).
- Confirm that **audio playback**, **playlists**, **queue**, **Wrapped**, **telemetry** (local only), and **search** behave identically.
- If any browser-specific assumption breaks in Electron (e.g., hard-coded `window.location.origin` assumptions), patch the renderer minimally in `web/` so it works in both browser and Electron.

### 6. Custom app icon (no Electron logo)

- Prepare a **music-themed `.ico` file** for Windows.
- Configure Electron to use it:
  - Set the `icon` property on the `BrowserWindow` in `main.ts`, pointing to the built icon file.
  - Configure **electron-builder** in the root `package.json` (or `electron-builder.yml`) with:
    - `appId`, `productName`.
    - `win` target(s) (e.g., `nsis`) and `icon` path to the custom icon.
- Optionally include `.png` variants for use in the app about dialog or splash screens.

### 7. Set up electron-builder for Windows installer

- In the root `package.json`, add an `"build"` section for electron-builder, e.g.:
  - `directories.output` for build artifacts.
  - `files` configuration to include:
    - Compiled Electron code.
    - Built `web/dist` assets.
  - `win` configuration specifying:
    - Target `nsis` (or `portable` if desired in addition).
    - Custom icon and metadata.
- Verify that running `npm run build` produces a Windows installer (`.exe`), and installing it yields a working app with the custom icon in:
  - Start menu / taskbar.
  - Window title bar.

### 8. Developer experience and docs

- Add a concise `README.md` at the `Music-electron` root detailing:
  - How to run in dev:
    - `npm install` at root (and in `web/` if separate).
    - `npm run dev` to start Vite and Electron together.
  - How to build:
    - `npm run build` for the final installer.
  - Any caveats about updating the `web/` app from upstream.

### 9. Smoke testing

- Run through the key flows inside the installed Electron app to validate 1:1 behavior:
  - Import local audio files and folders.
  - Create and manage playlists and folders.
  - Queue management, repeat and shuffle.
  - Playback speed controls.
  - Wrapped view and session telemetry.
  - Search, theming, and profile switching.
- Confirm local data persists across app restarts (IndexedDB / localStorage still present under the app’s profile).

## Notes and assumptions

- **Platform**: Target is **Windows only** for this initial implementation, but the structure will allow future macOS/Linux configs.
- **Security**: Renderer remains browser-like; Node integration stays disabled, with a preload bridge ready for any future native integrations.
- **Functionality parity**: All behavior remains in the web app; Electron provides shell, packaging, and desktop presence, not new core features (for v1).

