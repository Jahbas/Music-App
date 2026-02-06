import { contextBridge, ipcRenderer } from 'electron';

// Expose a minimal, typed API surface for future native integrations.
// Right now we don't need any special Electron-only functions because
// the web app already runs fully in the browser environment.

contextBridge.exposeInMainWorld('electronAPI', {
  windowControl: (action: 'minimize' | 'maximize' | 'close' | 'toggle-maximize') => {
    ipcRenderer.send('window-control', action);
  },
});

export {};

