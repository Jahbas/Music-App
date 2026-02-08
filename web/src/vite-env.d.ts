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
      parseMetadataFromPath?: (path: string) => Promise<{
        title: string;
        artist: string;
        album: string;
        duration: number;
        year?: number;
        artworkData?: ArrayBuffer;
        artworkMime?: string;
        hash: string;
      } | null>;
      getAudioUrl?: (filePath: string) => Promise<string>;
      listAudioPaths?: (dirPath: string) => Promise<string[]>;
      listDirectSubdirectories?: (dirPath: string) => Promise<string[]>;
      pickDirectory?: (defaultPath?: string) => Promise<string | null>;
      /** Fetch Deezer API URL from main process (bypasses CORS). */
      fetchDeezerUrl?: (url: string) => Promise<{ ok: boolean; status: number; body: string | null }>;
      getPathForFile?: (file: File) => string;
      statPath?: (path: string) => Promise<{ isDirectory: boolean }>;
      getRunOnStartup?: () => Promise<boolean>;
      setRunOnStartup?: (value: boolean) => Promise<void>;
      setMinimizeToTray?: (value: boolean) => void;
      onTrayMenuAction?: (cb: (action: "pause" | "play" | "mute" | "unmute" | "show" | "quit") => void) => () => void;
    };
    __getTrayMenuState?: () => { isPlaying: boolean; isMuted: boolean; theme: { accent: string; bg: string; surface: string; text: string; border: string; hover: string } };
  }
}

export {};
