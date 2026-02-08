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
  /** Get filesystem path for a dropped File (for drag-drop folder support when getAsFileSystemHandle is unavailable). */
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  /** Check if a path is a directory (for classifying dropped items). */
  statPath: (filePath: string) => ipcRenderer.invoke('stat-path', filePath) as Promise<{ isDirectory: boolean }>,
});

export {};

