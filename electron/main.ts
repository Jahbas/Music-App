import { app, BrowserWindow, ipcMain, shell, dialog, Tray, Menu, screen } from 'electron';
import * as path from 'path';
import * as url from 'url';
import chokidar, { type FSWatcher } from 'chokidar';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as mm from 'music-metadata';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let minimizeToTray = false;

const isDev = !app.isPackaged;

function getIconPath(filename: string): string {
  return app.isPackaged
    ? path.join(app.getAppPath(), 'build', 'icons', filename)
    : path.join(process.cwd(), 'build', 'icons', filename);
}

function getTrayMenuHtmlPath(): string {
  return app.isPackaged
    ? path.join(app.getAppPath(), 'build', 'tray-menu.html')
    : path.join(process.cwd(), 'build', 'tray-menu.html');
}

type TrayMenuState = {
  isPlaying: boolean;
  isMuted: boolean;
  theme: Record<string, string>;
};

let trayMenuWindow: BrowserWindow | null = null;

async function getTrayMenuStateFromRenderer(): Promise<TrayMenuState> {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { isPlaying: false, isMuted: true, theme: {} };
  }
  try {
    const state = await mainWindow.webContents.executeJavaScript(
      `(function(){ return window.__getTrayMenuState ? window.__getTrayMenuState() : { isPlaying: false, isMuted: true, theme: {} }; })()`
    );
    return state as TrayMenuState;
  } catch {
    return { isPlaying: false, isMuted: true, theme: {} };
  }
}

function closeTrayMenuWindow() {
  if (trayMenuWindow && !trayMenuWindow.isDestroyed()) {
    trayMenuWindow.close();
    trayMenuWindow = null;
  }
}

function showTrayMenuWindow() {
  const statePromise = getTrayMenuStateFromRenderer();

  if (trayMenuWindow && !trayMenuWindow.isDestroyed()) {
    trayMenuWindow.close();
    trayMenuWindow = null;
  }

  const preloadPath = path.join(__dirname, 'tray-menu-preload.js');
  trayMenuWindow = new BrowserWindow({
    width: 180,
    height: 220,
    frame: false,
    resizable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: false,
    hasShadow: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  trayMenuWindow.setMenu(null);
  trayMenuWindow.loadFile(getTrayMenuHtmlPath());

  trayMenuWindow.on('closed', () => {
    trayMenuWindow = null;
  });

  trayMenuWindow.on('blur', () => {
    closeTrayMenuWindow();
  });

  trayMenuWindow.webContents.on('did-finish-load', async () => {
    const state = await statePromise;
    if (trayMenuWindow && !trayMenuWindow.isDestroyed()) {
      trayMenuWindow.webContents.send('tray-menu-state', state);
      const bounds = tray!.getBounds();
      const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
      const winSize = trayMenuWindow.getSize();
      let x = bounds.x + Math.floor(bounds.width / 2) - Math.floor(winSize[0] / 2);
      let y = bounds.y + bounds.height;
              if (process.platform === 'win32') {
                y = bounds.y - winSize[1] - 4;
              }
      if (process.platform === 'darwin') {
        y = bounds.y + bounds.height + 4;
      }
      x = Math.max(display.bounds.x, Math.min(x, display.bounds.x + display.bounds.width - winSize[0]));
      y = Math.max(display.bounds.y, Math.min(y, display.bounds.y + display.bounds.height - winSize[1]));
      trayMenuWindow!.setPosition(x, y);
      trayMenuWindow!.show();
    }
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Music Player',
    // Use a frameless window so we can draw a fully custom title bar
    frame: false,
    // Helps on macOS to get a clean, minimal title bar area
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    // Start in windowed mode at 1600x800, but allow fullscreen
    fullscreen: false,
    fullscreenable: true,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    },
    // Use the custom PNG/ICO artwork placed in build/icons (app-relative when packaged)
    icon: app.isPackaged
      ? path.join(app.getAppPath(), 'build', 'icons', 'app.png')
      : path.join(process.cwd(), 'build', 'icons', 'app.png')
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = url.format({
      pathname: path.join(__dirname, '..', 'web', 'dist', 'index.html'),
      protocol: 'file:',
      slashes: true
    });
    mainWindow.loadURL(indexPath);
  }

  // Useful for diagnosing blank/grey windows in dev
  if (isDev) {
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      // eslint-disable-next-line no-console
      console.error('did-fail-load', { errorCode, errorDescription, validatedURL });
    });
    mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      // eslint-disable-next-line no-console
      console.log('renderer-console', { level, message, line, sourceId });
    });
  }

  // Ensure any window.open or target="_blank" links open in the user's
  // default browser instead of creating a new in-app window.
  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (!targetUrl) {
      return { action: 'deny' };
    }
    shell.openExternal(targetUrl);
    return { action: 'deny' };
  });

  // Hide native scrollbars while keeping scrolling behavior
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.insertCSS(`
      html, body {
        overflow: auto;
        scrollbar-width: none;
      }

      html::-webkit-scrollbar,
      body::-webkit-scrollbar {
        display: none;
      }

      * {
        scrollbar-width: none;
      }

      *::-webkit-scrollbar {
        display: none;
      }
    `);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const SUPPORTED_EXTENSIONS = new Set([
  '.mp3',
  '.wav',
  '.ogg',
  '.flac',
  '.aac',
  '.m4a',
  '.webm',
]);

function isSupportedAudioPath(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

async function listAudioFilesRecursive(dirPath: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        // eslint-disable-next-line no-await-in-loop
        const sub = await listAudioFilesRecursive(full);
        results.push(...sub);
      } else if (entry.isFile() && isSupportedAudioPath(full)) {
        results.push(full);
      }
    }
  } catch {
    // ignore unreadable directories
  }
  return results;
}

type WatchConfig = {
  folderId: string;
  playlistId: string;
  path: string;
};

const watchers = new Map<string, { watcher: FSWatcher; seen: Set<string>; config: WatchConfig }>();

function stopWatcher(folderId: string) {
  const existing = watchers.get(folderId);
  if (!existing) return;
  try {
    existing.watcher.close();
  } catch {
    // ignore
  }
  watchers.delete(folderId);
}

async function startWatcher(config: WatchConfig) {
  stopWatcher(config.folderId);

  const normalized = path.resolve(config.path);
  const seen = new Set<string>();

  // Initial scan: send all supported audio files, and mark as seen.
  const initialFiles = await listAudioFilesRecursive(normalized);
  for (const f of initialFiles) seen.add(f);
  if (mainWindow && initialFiles.length > 0) {
    mainWindow.webContents.send('watch-files', {
      folderId: config.folderId,
      playlistId: config.playlistId,
      paths: initialFiles,
    });
  }

  const watcher = chokidar.watch(normalized, {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 800,
      pollInterval: 100,
    },
  });

  const emitNew = (filePath: string) => {
    if (!mainWindow) return;
    if (!isSupportedAudioPath(filePath)) return;
    const resolved = path.resolve(filePath);
    if (seen.has(resolved)) return;
    seen.add(resolved);
    mainWindow.webContents.send('watch-files', {
      folderId: config.folderId,
      playlistId: config.playlistId,
      paths: [resolved],
    });
  };

  watcher.on('add', emitNew);
  watcher.on('change', emitNew);

  watchers.set(config.folderId, { watcher, seen, config: { ...config, path: normalized } });
}

app.whenReady().then(() => {
  // Ensure the app shows up as "Music" instead of "Electron" in Task Manager / alt‑tab on most platforms
  app.setName('Music');

  // On Windows, set an explicit AppUserModelID so the taskbar and notifications use our name and icon
  if (process.platform === 'win32') {
    app.setAppUserModelId('Music');
  }

  createMainWindow();

  const trayIconPath = process.platform === 'win32' ? getIconPath('app.ico') : getIconPath('app.png');
  tray = new Tray(trayIconPath);
  tray.setToolTip('Music');
  tray.on('click', () => {
    showTrayMenuWindow();
  });

  function buildTrayContextMenu() {
    return getTrayMenuStateFromRenderer().then((state) =>
      Menu.buildFromTemplate([
        { label: 'Show', click: () => { closeTrayMenuWindow(); mainWindow?.show(); mainWindow?.focus(); } },
        { label: state.isPlaying ? 'Pause' : 'Play', click: () => {
          closeTrayMenuWindow();
          mainWindow?.webContents.send('tray-menu-action', state.isPlaying ? 'pause' : 'play');
        } },
        { label: state.isMuted ? 'Unmute' : 'Mute', click: () => {
          closeTrayMenuWindow();
          mainWindow?.webContents.send('tray-menu-action', state.isMuted ? 'unmute' : 'mute');
        } },
        { type: 'separator' },
        { label: 'Quit', click: () => { closeTrayMenuWindow(); app.quit(); } },
      ])
    );
  }

  tray.on('right-click', () => {
    buildTrayContextMenu().then((menu) => tray!.popUpContextMenu(menu));
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

ipcMain.on('window-control', (event, action: 'minimize' | 'maximize' | 'close' | 'toggle-maximize') => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return;

  switch (action) {
    case 'minimize':
      window.minimize();
      break;
    case 'maximize':
      window.maximize();
      break;
    case 'toggle-maximize':
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
      break;
    case 'close':
      if (minimizeToTray) {
        window.hide();
      } else {
        window.close();
      }
      break;
    default:
      break;
  }
});

ipcMain.handle('open-external', (_event, url: string) => {
  if (typeof url !== 'string' || url.trim() === '') {
    return;
  }
  // Open links in the user's default browser instead of inside the app window.
  return shell.openExternal(url);
});

ipcMain.on('watch-start', (_event, args: WatchConfig) => {
  if (!args || typeof args.folderId !== 'string' || typeof args.playlistId !== 'string' || typeof args.path !== 'string') {
    return;
  }
  if (!args.folderId || !args.playlistId || !args.path.trim()) return;
  void startWatcher({ folderId: args.folderId, playlistId: args.playlistId, path: args.path });
});

ipcMain.on('watch-stop', (_event, folderId: string) => {
  if (typeof folderId !== 'string' || !folderId) return;
  stopWatcher(folderId);
});

/** Normalize tag strings (strip nulls, trim). */
function stripNullsAndTrim(value: string | undefined | null): string {
  return value ? value.replace(/\0/g, '').trim() : '';
}

type ParseMetadataFromPathResult = {
  title: string;
  artist: string;
  album: string;
  duration: number;
  year?: number;
  artworkData?: ArrayBuffer;
  artworkMime?: string;
  hash: string;
};

/** Parse audio metadata from a file path in the main process (no file bytes sent to renderer). */
async function parseMetadataFromPath(filePath: string): Promise<ParseMetadataFromPathResult | null> {
  if (typeof filePath !== 'string' || !filePath.trim()) return null;
  const resolved = path.resolve(filePath);
  try {
    const buf = await fs.promises.readFile(resolved);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    const metadata = await mm.parseBuffer(new Uint8Array(buf), { path: resolved });
    const common = metadata.common;
    const commonAny = common as unknown as Record<string, unknown>;
    const rawTitle =
      stripNullsAndTrim(common.title) ||
      stripNullsAndTrim(commonAny.subtitle as string) ||
      stripNullsAndTrim(commonAny.series as string) ||
      stripNullsAndTrim(commonAny.show as string);
    const fileName = path.basename(resolved).replace(/\.[^/.]+$/, '');
    const title = rawTitle || fileName;

    const artistsJoined = Array.isArray(common.artists)
      ? common.artists.map((a) => stripNullsAndTrim(a)).filter(Boolean).join(', ')
      : '';
    const rawArtist =
      stripNullsAndTrim(common.artist) ||
      stripNullsAndTrim(common.albumartist) ||
      artistsJoined ||
      stripNullsAndTrim((common.composer && common.composer[0]) as string) ||
      stripNullsAndTrim(commonAny.writer as string) ||
      stripNullsAndTrim(commonAny.author as string);
    const artist = rawArtist || 'Unknown Artist';

    const rawAlbum =
      stripNullsAndTrim(common.album) ||
      stripNullsAndTrim(commonAny.series as string) ||
      stripNullsAndTrim(commonAny.show as string) ||
      stripNullsAndTrim(commonAny.grouping as string);
    const album = rawAlbum || 'Unknown Album';

    let year: number | undefined;
    if (typeof common.year === 'number' && Number.isFinite(common.year)) {
      year = common.year;
    } else if (typeof commonAny.date === 'string') {
      const match = (String(commonAny.date)).match(/(\d{4})/);
      if (match) {
        const parsed = Number(match[1]);
        if (Number.isFinite(parsed)) year = parsed;
      }
    }

    const duration = metadata.format.duration
      ? Math.round(metadata.format.duration)
      : 0;

    const pictures = common.picture ?? [];
    const preferredPicture =
      pictures.find((p) => {
        const type = (p.type || '').toLowerCase();
        return type.includes('front') || type.includes('cover');
      }) ?? pictures[0];

    let artworkData: ArrayBuffer | undefined;
    let artworkMime: string | undefined;
    if (preferredPicture?.data) {
      const b = new Uint8Array(preferredPicture.data);
      artworkData = b.buffer.slice(0, b.byteLength);
      artworkMime = preferredPicture.format;
    }

    return {
      title,
      artist,
      album,
      duration,
      year,
      artworkData,
      artworkMime,
      hash,
    };
  } catch {
    return null;
  }
}

ipcMain.handle('parse-metadata-from-path', async (_event, filePath: string) => {
  if (typeof filePath !== 'string' || !filePath.trim()) return null;
  return parseMetadataFromPath(filePath);
});

/** Returns a playable file:// URL for the given path after validating it exists and is a file. */
ipcMain.handle('get-audio-url', async (_event, filePath: string) => {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new Error('Invalid path');
  }
  const resolved = path.resolve(filePath);
  try {
    const stats = await fs.promises.stat(resolved);
    if (!stats.isFile()) throw new Error('Not a file');
  } catch {
    throw new Error('File not found or not accessible');
  }
  return url.pathToFileURL(resolved).toString();
});

/** @deprecated Use parse-metadata-from-path + path-based tracks instead. Kept for compatibility. */
ipcMain.handle('read-file-from-path', async (_event, filePath: string) => {
  if (typeof filePath !== 'string' || !filePath) {
    throw new Error('Invalid path');
  }
  const buf = await fs.promises.readFile(filePath);
  const name = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  const mimeType =
    ext === '.mp3' ? 'audio/mpeg' :
    ext === '.wav' ? 'audio/wav' :
    ext === '.ogg' ? 'audio/ogg' :
    ext === '.flac' ? 'audio/flac' :
    ext === '.aac' ? 'audio/aac' :
    ext === '.m4a' ? 'audio/mp4' :
    ext === '.webm' ? 'audio/webm' :
    'application/octet-stream';
  return { name, mimeType, hash, data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
});

ipcMain.handle('list-audio-paths', async (_event, dirPath: string) => {
  if (typeof dirPath !== 'string' || !dirPath.trim()) {
    return [];
  }
  const normalized = path.resolve(dirPath);
  return listAudioFilesRecursive(normalized);
});

async function listDirectSubdirectories(dirPath: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        results.push(path.join(dirPath, entry.name));
      }
    }
  } catch {
    // ignore unreadable
  }
  return results;
}

ipcMain.handle('list-direct-subdirectories', async (_event, dirPath: string) => {
  if (typeof dirPath !== 'string' || !dirPath.trim()) return [];
  return listDirectSubdirectories(path.resolve(dirPath));
});

ipcMain.handle('stat-path', async (_event, filePath: string) => {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    return { isDirectory: false };
  }
  try {
    const stats = await fs.promises.stat(path.resolve(filePath));
    return { isDirectory: stats.isDirectory() };
  } catch {
    return { isDirectory: false };
  }
});

// Deezer API has no CORS headers; fetch from main process so renderer can get artist images.
ipcMain.handle('fetch-deezer-url', async (_event, requestUrl: string) => {
  if (typeof requestUrl !== 'string' || !requestUrl.startsWith('https://api.deezer.com/')) {
    return { ok: false, status: 0, body: null };
  }
  try {
    const res = await fetch(requestUrl, { headers: { Accept: 'application/json' } });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body };
  } catch {
    return { ok: false, status: 0, body: null };
  }
});

ipcMain.handle('get-run-on-startup', () => {
  return app.getLoginItemSettings().openAtLogin ?? false;
});

ipcMain.handle('set-run-on-startup', (_event, value: boolean) => {
  app.setLoginItemSettings({ openAtLogin: value });
});

ipcMain.on('set-minimize-to-tray', (_event, value: boolean) => {
  minimizeToTray = value === true;
});

ipcMain.on('tray-menu-action', (event, action: 'pause' | 'play' | 'mute' | 'unmute' | 'show' | 'quit') => {
  closeTrayMenuWindow();
  if (action === 'show') {
    mainWindow?.show();
    mainWindow?.focus();
  } else if (action === 'quit') {
    app.quit();
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tray-menu-action', action);
  }
});

ipcMain.handle('pick-directory', async (_event, defaultPath?: string) => {
  // Native picker for choosing a single folder.
  const dialogOptions: Electron.OpenDialogOptions = {
    properties: ['openDirectory'],
    title: 'Choose folder to watch',
  };

  if (typeof defaultPath === 'string' && defaultPath.trim()) {
    const normalized = path.resolve(defaultPath.trim());
    try {
      const stats = await fs.promises.stat(normalized);
      if (stats.isDirectory()) {
        dialogOptions.defaultPath = normalized;
      }
    } catch {
      // If the path doesn't exist or isn't readable, just omit defaultPath.
    }
  }

  const result = await dialog.showOpenDialog(dialogOptions);
  if (result.canceled) return null;
  return result.filePaths?.[0] ?? null;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

