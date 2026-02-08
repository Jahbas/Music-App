import { contextBridge, ipcRenderer } from 'electron';

const trayMenuAPI = {
  onState: (cb: (state: { isPlaying: boolean; isMuted: boolean; theme: Record<string, string> }) => void) => {
    const handler = (_event: unknown, state: { isPlaying: boolean; isMuted: boolean; theme: Record<string, string> }) => cb(state);
    ipcRenderer.on('tray-menu-state', handler);
    return () => ipcRenderer.removeListener('tray-menu-state', handler);
  },
  sendAction: (action: 'pause' | 'play' | 'mute' | 'unmute' | 'show' | 'quit') => {
    ipcRenderer.send('tray-menu-action', action);
  },
};

contextBridge.exposeInMainWorld('trayMenuAPI', trayMenuAPI);

export {};
