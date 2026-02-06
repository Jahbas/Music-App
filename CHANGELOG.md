## 1.4.0

- Align Electron wrapper version with upstream Music web app `1.4.0`.
- Fix production build for Electron by setting Vite `base: "./"` so assets load correctly under `file://`.
- Configure Electron to:
  - Use the custom icon from `build/icons/app.png` / `build/icons/app.ico`.
  - Show up as `Music` (not `Electron`) in the installed app, taskbar, and installer metadata.
- Document simple install / run steps for non-technical users.

## 1.0.0

- First Electron wrapper for the Music web player.
- Basic dev and production build wiring using `electron`, `electron-builder`, and Vite.

