import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as url from 'url';

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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

