## 1.5.0

### New

- **Artists view:** New route `/artists` to browse artists derived from your library. Lists artists with profile pictures (from iTunes and Deezer), metadata and links from MusicBrainz, and optional cached artist data. Open from the sidebar “Artists” button or by navigating to Artists.
- **Sidebar Artists button:** Sidebar shows an “Artists” entry with the current track’s artist avatar (or placeholder). Click to go to the Artists view; artist data is preloaded when a track is playing.
- **Artist info modal:** View full artist details (name, type, country, links to streaming and social) and link tiles (Spotify, Deezer, YouTube, etc.) with favicons. Artist images and metadata are fetched from iTunes, Deezer, and MusicBrainz and can be cached on device (Settings → Data).
- **Folder import preview:** When you drop a folder on the sidebar that contains multiple subfolders, a preview modal lists the playlists that would be created. You can confirm or cancel before importing; each subfolder becomes a playlist.
- **Liked song toast:** Saving a track to Liked Songs shows a short toast so you get clear feedback that it was added.

### Improvements

- **Folder drop on sidebar:** Dropping a folder on the sidebar now creates one playlist per subfolder (or a single playlist if the folder has no subfolders). Loose audio files in the root can be added to the first playlist. In the packaged app, when the File System Access API isn’t available, folder drops use Electron’s `listAudioPaths` and `listDirectSubdirectories` so imports still work.
- **Sidebar layout:** Folders section appears above Playlists in the scrollable area; navigation region has an accessible label for screen readers.

### Packaged app (EXE) fixes

- **Window icon in production:** Icon path now uses `app.getAppPath()` when packaged so the taskbar and window show the correct app icon instead of a missing or wrong icon. In dev, icon still uses `process.cwd()` so `npm run dev` works unchanged.
- **Icons included in build:** `build/icons/**` added to electron-builder `files` so `app.png`, `app.ico`, and `app.svg` are shipped inside the app and the window icon can resolve at runtime.
- **Favicon under file://:** Favicon link in `web/index.html` changed from `/favicon.png` to `./favicon.png` so it loads correctly when the app is opened via `file://` in the packaged EXE (absolute paths were resolving to `file:///favicon.png` and failing).

### Bug fixes

- **Production build (TypeScript):** Fixed three issues that blocked `npm run build`:
  - **ArtistInfoModal:** `KNOWN_LINK_DOMAINS` typed as `Set<string>` so `host` (string) is valid for `.has()`; previously the set was inferred as literal union and caused TS2345.
  - **EditPlaylistModal:** Watchlist “Browse” button now checks `window.electronAPI?.pickDirectory` before invoking so the call is never “possibly undefined” (TS2722).
  - **folderDrop.ts:** Introduced `DirHandleWithEntries` and use it for `FileSystemDirectoryHandle.entries()` so the File System Access API is correctly typed where the DOM lib does not declare `entries()`.

### Cleanup and behavior

- **Dead code removed:** Deleted `web/src/utils/buffer-polyfill.ts`; it was never imported. Buffer is already set on `globalThis` in `main.tsx` before the app runs.
- **Main process logging:** `did-fail-load` and `console-message` handlers in Electron main now run only when `isDev` is true. Packaged EXE no longer logs to a console; devs still see failures when running `npm run dev`.
- **Renderer metadata errors:** `console.error("Failed to parse audio metadata", …)` in `web/src/utils/metadata.ts` is now gated with `import.meta.env.DEV` so production builds do not log parse failures to the console.
- **db.ts:** Normalized indentation in the `theme` store block (lines 44–46) for consistency; no behavior change.

### UI and copy

- **Telemetry empty state:** “close the tab or switch away” changed to “close the app or switch away” so wording matches a desktop app.
- **Settings → Data & privacy:** “How your data is stored” now states that data is “stored locally in this app on your device” and explicitly adds “This is not browser storage—it stays with the app” so users understand it’s app-local, not browser-dependent.

### Version and docs

- Version set to **1.5.0** in root `package.json`, `web/package.json`, and README (including installer example `Music Setup 1.5.0.exe`).

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

