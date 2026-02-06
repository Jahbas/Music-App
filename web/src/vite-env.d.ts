/// <reference types="vite/client" />

declare global {
  interface Window {
    electronAPI?: {
      windowControl: (action: "minimize" | "maximize" | "close" | "toggle-maximize") => void;
      openExternal: (url: string) => void;
      watchStart?: (args: { folderId: string; path: string; playlistId: string }) => void;
      watchStop?: (folderId: string) => void;
      onWatchFiles?: (cb: (payload: { folderId: string; playlistId: string; paths: string[] }) => void) => () => void;
      readFileFromPath?: (path: string) => Promise<{ name: string; mimeType: string; data: ArrayBuffer; hash: string }>;
      listAudioPaths?: (dirPath: string) => Promise<string[]>;
      pickDirectory?: (defaultPath?: string) => Promise<string | null>;
    };
  }
}

export {};
