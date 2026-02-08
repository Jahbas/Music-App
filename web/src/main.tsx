import { Buffer } from "buffer";
import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { startFaviconPreload } from "./utils/faviconCache";

// music-metadata-browser expects Node's Buffer in the global scope (renderer has no Node)
(globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;

// Preload favicons for link tiles (Spotify, Deezer, TikTok, etc.) so they stay in memory
startFaviconPreload();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
