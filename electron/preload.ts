import { contextBridge, ipcRenderer } from 'electron';

// Expose a minimal, typed API surface for future native integrations.
// Right now we don't need any special Electron-only functions because
// the web app already runs fully in the browser environment.

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
  /**
   * Open a native directory picker. When a default path is provided and exists,
   * the dialog will start in that folder which makes selecting / tweaking
   * watchlist folders much faster.
   */
  pickDirectory: async (defaultPath?: string) => {
    return ipcRenderer.invoke('pick-directory', defaultPath);
  },
});

export {};

