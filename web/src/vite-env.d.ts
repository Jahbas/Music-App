/// <reference types="vite/client" />

declare global {
  interface Window {
    electronAPI?: {
      windowControl: (action: "minimize" | "maximize" | "close" | "toggle-maximize") => void;
    };
  }
}

export {};
