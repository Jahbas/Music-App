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
      listDirectSubdirectories?: (dirPath: string) => Promise<string[]>;
      pickDirectory?: (defaultPath?: string) => Promise<string | null>;
      /** Fetch Deezer API URL from main process (bypasses CORS). */
      fetchDeezerUrl?: (url: string) => Promise<{ ok: boolean; status: number; body: string | null }>;
      getPathForFile?: (file: File) => string;
      statPath?: (path: string) => Promise<{ isDirectory: boolean }>;
    };
  }
}

export {};
