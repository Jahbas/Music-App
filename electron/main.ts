import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import * as path from 'path';
import * as url from 'url';
import chokidar, { type FSWatcher } from 'chokidar';
import * as fs from 'fs';
import * as crypto from 'crypto';

let mainWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged;

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
    // Use the custom PNG/ICO artwork placed in build/icons
    icon: path.join(process.cwd(), 'build', 'icons', 'app.png')
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

  // Useful for diagnosing blank/grey windows in packaged builds
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    // eslint-disable-next-line no-console
    console.error('did-fail-load', { errorCode, errorDescription, validatedURL });
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    // eslint-disable-next-line no-console
    console.log('renderer-console', { level, message, line, sourceId });
  });

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
      window.close();
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

