import { contextBridge, ipcRenderer, webUtils } from 'electron';

// Expose a minimal, typed API for the Electron renderer (window controls, file system, native dialogs).

contextBridge.exposeInMainWorld('electronAPI', {
  windowControl: (action: 'minimize' | 'maximize' | 'close' | 'toggle-maximize') => {
    ipcRenderer.send('window-control', action);
  },
  openExternal: (url: string) => {
    ipcRenderer.invoke('open-external', url);
  },
  watchStart: (args: { folderId: string; path: string; playlistId: string }) => {
    ipcRenderer.send('watch-start', args);
  },
  watchStop: (folderId: string) => {
    ipcRenderer.send('watch-stop', folderId);
  },
  onWatchFiles: (cb: (payload: { folderId: string; playlistId: string; paths: string[] }) => void) => {
    const handler = (_event: unknown, payload: { folderId: string; playlistId: string; paths: string[] }) => cb(payload);
    ipcRenderer.on('watch-files', handler);
    return () => ipcRenderer.removeListener('watch-files', handler);
  },
  readFileFromPath: (filePath: string) => {
    return ipcRenderer.invoke('read-file-from-path', filePath);
  },
  /** Parse audio metadata from a file path in main process (no file bytes to renderer). Returns null if unreadable. */
  parseMetadataFromPath: (filePath: string) => {
    return ipcRenderer.invoke('parse-metadata-from-path', filePath) as Promise<{
      title: string;
      artist: string;
      album: string;
      duration: number;
      year?: number;
      artworkData?: ArrayBuffer;
      artworkMime?: string;
      hash: string;
    } | null>;
  },
  /** Get a playable file:// URL for the given path (validates path in main). */
  getAudioUrl: (filePath: string) => {
    return ipcRenderer.invoke('get-audio-url', filePath) as Promise<string>;
  },
  listAudioPaths: (dirPath: string) => {
    return ipcRenderer.invoke('list-audio-paths', dirPath);
  },
  listDirectSubdirectories: (dirPath: string) => {
    return ipcRenderer.invoke('list-direct-subdirectories', dirPath) as Promise<string[]>;
  },
  /**
   * Open a native directory picker. When a default path is provided and exists,
   * the dialog will start in that folder which makes selecting / tweaking
   * watchlist folders much faster.
   */
  pickDirectory: async (defaultPath?: string) => {
    return ipcRenderer.invoke('pick-directory', defaultPath);
  },
  /** Fetch a Deezer API URL from main process (bypasses CORS). Returns { ok, status, body }. */
  fetchDeezerUrl: (url: string) => {
    return ipcRenderer.invoke('fetch-deezer-url', url) as Promise<{ ok: boolean; status: number; body: string | null }>;
  },
  getRunOnStartup: () => ipcRenderer.invoke('get-run-on-startup') as Promise<boolean>,
  setRunOnStartup: (value: boolean) => ipcRenderer.invoke('set-run-on-startup', value) as Promise<void>,
  setMinimizeToTray: (value: boolean) => {
    ipcRenderer.send('set-minimize-to-tray', value);
  },
  /** Get filesystem path for a dropped File (for drag-drop folder support when getAsFileSystemHandle is unavailable). */
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  /** Check if a path is a directory (for classifying dropped items). */
  statPath: (filePath: string) => ipcRenderer.invoke('stat-path', filePath) as Promise<{ isDirectory: boolean }>,
  /** Listen for tray menu actions (pause, play, mute, unmute, show, quit) from main. */
  onTrayMenuAction: (cb: (action: 'pause' | 'play' | 'mute' | 'unmute' | 'show' | 'quit') => void) => {
    const handler = (_event: unknown, action: 'pause' | 'play' | 'mute' | 'unmute' | 'show' | 'quit') => cb(action);
    ipcRenderer.on('tray-menu-action', handler);
    return () => ipcRenderer.removeListener('tray-menu-action', handler);
  },
});

export {};

