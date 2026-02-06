# Music App

A fast, local‑first desktop music player built on the open source [Music](https://github.com/Jahbas/Music) project.

Because everything runs locally and there is no heavy streaming client around it, **Music App typically uses noticeably less memory than big streaming apps like Spotify or Apple Music**, especially once your library is indexed and playing offline files.

Current desktop app version: **1.4.0** (see `CHANGELOG.md`).

## Structure

- `web/` – Original React/Vite music web app (runs fully in the browser context).
- `electron/` – Electron main and preload processes.
- `dist-electron/` – Compiled Electron TypeScript output.
- `web/dist/` – Built web assets for production.
- `build/icons/app.png` – Window/taskbar icon used by Electron at runtime.
- `build/icons/app.ico` – Windows installer / Start menu / Task Manager icon (multi-size, transparent).

## Quick start for non‑technical users

If you already have a built installer in `dist/` (for example: `Music Setup 1.4.0.exe`), you don’t need Node or npm:

1. Locate `Music Setup 1.4.0.exe` in the `dist/` folder.
2. Double‑click it and follow the installer steps.
3. Launch **Music** from the Start menu or desktop shortcut.

That’s it – you get the full Music player as a desktop app.

## Development

1. Install dependencies:

   ```bash
   npm install
   cd web && npm install
   ```

2. Run the dev app:

   ```bash
   cd ..
   npm run dev
   ```

   This will:

   - Start the Vite dev server for the web app on `http://localhost:5173`.
   - Launch Electron pointing at that dev server.

   All web features (IndexedDB library, playlists, queue, Wrapped, telemetry, drag-and-drop, keyboard shortcuts, themes, profiles, etc.) run unchanged inside the Electron window.

## Production build (for releasing a new installer)

1. Ensure your icons are in place:

   - `build/icons/app.png` – PNG with transparent background (used by the Electron window).
   - `build/icons/app.ico` – ICO with multiple sizes (16/32/48/64/128/256) and transparent background (used by the installer / EXE).

2. Build the app and installer:

   ```bash
   npm run build
   ```

   This will:

   - Build the web app into `web/dist` using Vite with `base: "./"` so assets work with `file://`.
   - Compile Electron TypeScript into `dist-electron`.
   - Run `electron-builder` to create a Windows installer in `dist/` (for example: `Music Setup 1.4.0.exe`).

3. Distribute the installer:

   - Share the `dist/Music Setup 1.4.0.exe` file.
   - Non‑technical users can install it by double‑clicking and following the wizard; they never need to touch Node, npm, or the source code.
