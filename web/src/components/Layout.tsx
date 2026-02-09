import { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAudio } from "../hooks/useAudio";
import { useLibraryStore } from "../stores/libraryStore";
import { usePlayHistoryStore } from "../stores/playHistoryStore";
import { usePlaylistStore } from "../stores/playlistStore";
import { useProfileStore } from "../stores/profileStore";
import { useFolderStore } from "../stores/folderStore";
import { useProfileLikesStore } from "../stores/profileLikesStore";
import { useArtistStore } from "../stores/artistStore";
import { useThemeStore } from "../stores/themeStore";
import { usePlayerStore } from "../stores/playerStore";
import { useTelemetry } from "../hooks/useTelemetry";
import { useShortcuts } from "../hooks/useShortcuts";
import { getMinimizeToTray } from "../utils/preferences";
import { imageDb } from "../db/db";
import { AddSongsProgress } from "./AddSongsProgress";
import { DragAddToPlaylistOverlay } from "./DragAddToPlaylistOverlay";
import { LikedSongToast } from "./LikedSongToast";
import { PlayerBar } from "./PlayerBar";
import { QueuePanel } from "./QueuePanel";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { SettingsModal } from "./SettingsModal";
import { useUpdateStore } from "../stores/updateStore";

export const Layout = () => {
  const navigate = useNavigate();
  const hydrateTheme = useThemeStore((state) => state.hydrate);
  const hydrateLibrary = useLibraryStore((state) => state.hydrate);
  const hydratePlaylists = usePlaylistStore((state) => state.hydrate);
  const hydrateProfiles = useProfileStore((state) => state.hydrate);
  const hydrateFolders = useFolderStore((state) => state.hydrate);
  const hydratePlayHistory = usePlayHistoryStore((state) => state.hydrate);
  const hydrateProfileLikes = useProfileLikesStore((state) => state.hydrate);
  const hydrateArtistCache = useArtistStore((state) => state.hydrate);
  const folders = useFolderStore((s) => s.folders);
  const playlists = usePlaylistStore((s) => s.playlists);
  const addFilePaths = useLibraryStore((s) => s.addFilePaths);
  const addTracksToPlaylist = usePlaylistStore((s) => s.addTracksToPlaylist);
  useAudio();
  useTelemetry();
  useShortcuts();

  const [draggingTrackIds, setDraggingTrackIds] = useState<string[]>([]);
  const [queuePanelOpen, setQueuePanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [installingUpdateFromPrompt, setInstallingUpdateFromPrompt] = useState(false);
  const checkForUpdates = useUpdateStore((s) => s.checkForUpdates);
  const latestVersion = useUpdateStore((s) => s.latestVersion);
  const currentVersion = useUpdateStore((s) => s.currentVersion);
  const notesPreview = useUpdateStore((s) => s.notesPreview);
  const releaseUrl = useUpdateStore((s) => s.releaseUrl);
  const downloadUrl = useUpdateStore((s) => s.downloadUrl);
  const hasUpdate = useUpdateStore((s) => s.hasUpdate);
  const shouldShowUpdatePrompt = useUpdateStore((s) => s.shouldShowPrompt);
  const setUpdateStatus = useUpdateStore((s) => s.setStatus);
  const markUpdatePromptSeen = useUpdateStore((s) => s.markPromptSeen);

  useEffect(() => {
    if (settingsOpen) setQueuePanelOpen(false);
  }, [settingsOpen]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.electronAPI?.setMinimizeToTray) {
      window.electronAPI.setMinimizeToTray(getMinimizeToTray());
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.electronAPI?.checkForUpdates) return;
    // Always perform a single background check on app startup so version
    // information and update availability are populated without having to
    // visit Settings or toggle any pref first.
    void checkForUpdates({ manual: false }).catch(() => {
      // Ignore background update check failures.
    });
  }, [checkForUpdates]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI?.onTrayMenuAction) return;
    window.__getTrayMenuState = () => {
      const s = usePlayerStore.getState();
      const root = document.documentElement;
      const getVar = (v: string) =>
        getComputedStyle(root).getPropertyValue(v).trim() || (v === "--color-accent" ? "#1db954" : "#060608");
      return {
        isPlaying: s.isPlaying,
        isMuted: s.volume === 0,
        theme: {
          accent: getVar("--color-accent"),
          bg: getVar("--color-bg"),
          surface: getVar("--color-surface"),
          text: getVar("--color-text"),
          border: getVar("--color-border"),
          hover: getVar("--color-hover"),
          hoverStrong: getComputedStyle(root).getPropertyValue("--color-hover-strong").trim(),
          muted: getComputedStyle(root).getPropertyValue("--color-muted").trim(),
        },
      };
    };
    const unsub = window.electronAPI.onTrayMenuAction((action) => {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/ac6a4641-4ef5-44d5-af07-c284a1a73d6e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Layout.tsx:tray',message:'tray-menu-action',data:{action},hypothesisId:'H4',timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const player = usePlayerStore.getState();
      switch (action) {
        case "show":
          break;
        case "pause":
          player.pause();
          break;
        case "play":
          player.play();
          break;
        case "mute":
          player.setVolume(0);
          break;
        case "unmute":
          usePlayerStore.getState().setVolume(0.8);
          break;
        case "quit":
          break;
        default:
          break;
      }
    });
    return () => {
      delete (window as Window & { __getTrayMenuState?: unknown }).__getTrayMenuState;
      unsub();
    };
  }, []);

  useEffect(() => {
    void hydrateTheme();
    void hydrateLibrary();
    void hydratePlaylists();
    void (async () => {
      await hydrateProfiles();
      await hydrateFolders();
      await hydratePlayHistory();
      await hydrateProfileLikes();
      await hydrateArtistCache();
    })();
  }, [
    hydrateTheme,
    hydrateLibrary,
    hydratePlaylists,
    hydrateProfiles,
    hydrateFolders,
    hydratePlayHistory,
    hydrateProfileLikes,
    hydrateArtistCache,
  ]);

  // Resume watched playlist watchers (desktop app only).
  const startedWatchersRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.watchStart || !api?.watchStop) return;

    const started = startedWatchersRef.current;
    const enabledIds = new Set<string>();

    for (const p of playlists) {
      const enabled = p.watchEnabled === true && Boolean(p.watchPath);
      if (!enabled) continue;
      enabledIds.add(p.id);
      if (!started.has(p.id)) {
        api.watchStart({ folderId: p.id, path: p.watchPath!, playlistId: p.id });
        started.add(p.id);
      }
    }

    for (const id of Array.from(started)) {
      if (!enabledIds.has(id)) {
        api.watchStop(id);
        started.delete(id);
      }
    }
  }, [playlists]);

  // Receive watcher events (desktop app only) and import new files.
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onWatchFiles) return;
    return api.onWatchFiles(async ({ playlistId, paths }) => {
      const trackIds = await addFilePaths(paths);
      if (trackIds.length > 0) {
        await addTracksToPlaylist(playlistId, trackIds);
      }
    });
  }, [addFilePaths, addTracksToPlaylist]);

  // Global shortcuts are handled by useShortcuts.

  const dragActive = draggingTrackIds.length > 0;

  const dragContext = useMemo(
    () => ({
      dragActive,
      draggingTrackIds,
      onDragStart: (trackIds: string[]) => setDraggingTrackIds(trackIds),
      onDragEnd: () => setDraggingTrackIds([]),
    }),
    [dragActive, draggingTrackIds]
  );

  const handleAppDragOver = (event: React.DragEvent) => {
    if (event.dataTransfer.types.includes("Files")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  };

  const handleAppDrop = (event: React.DragEvent) => {
    if (event.dataTransfer.types.includes("Files")) {
      event.preventDefault();
    }
  };

  return (
    <div
      className={`app-shell${settingsOpen ? " app-shell--settings-open" : ""}${queuePanelOpen ? " app-shell--queue-open" : ""}`}
      onDragOver={handleAppDragOver}
      onDrop={handleAppDrop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Sidebar
        dragContext={dragContext}
        onNavigate={(path) => navigate(path)}
      />
      <div className="app-main">
        <TopBar
          isSettingsOpen={settingsOpen}
          onOpenSettings={() => setSettingsOpen(true)}
          onCloseSettings={() => setSettingsOpen(false)}
        />
        <div className="app-content">
          <Outlet context={dragContext} />
        </div>
      </div>
      {!settingsOpen && (
        <PlayerBar
          queuePanelOpen={queuePanelOpen}
          onToggleQueuePanel={() => setQueuePanelOpen((v) => !v)}
        />
      )}
      {queuePanelOpen && (
        <QueuePanel onClose={() => setQueuePanelOpen(false)} />
      )}
      {hasUpdate && shouldShowUpdatePrompt && (
        <div className="update-prompt">
          <div className="update-prompt-content">
            <div className="update-prompt-header">
              <span className="update-prompt-title">New version available</span>
              <button
                type="button"
                className="update-prompt-close"
                aria-label="Dismiss update notification"
                onClick={markUpdatePromptSeen}
              >
                ✕
              </button>
            </div>
            <p className="update-prompt-subtitle">
              {currentVersion && latestVersion
                ? `You’re on v${currentVersion}. v${latestVersion} is ready with improvements and fixes.`
                : "A new version of Music is available with improvements and fixes."}
            </p>
            {notesPreview && (
              <div className="update-prompt-notes">
                <p className="update-prompt-notes-title">What’s new</p>
                <p className="update-prompt-notes-body">{notesPreview}</p>
              </div>
            )}
            <div className="update-prompt-actions">
              <button
                type="button"
                className="primary-button"
                disabled={
                  installingUpdateFromPrompt ||
                  !downloadUrl ||
                  typeof window.electronAPI?.downloadAndRunUpdate !== "function"
                }
                onClick={async () => {
                  if (!downloadUrl || !window.electronAPI?.downloadAndRunUpdate) return;
                  setInstallingUpdateFromPrompt(true);
                  setUpdateStatus("Downloading update and restarting…");
                  try {
                    await window.electronAPI.downloadAndRunUpdate(downloadUrl);
                  } catch {
                    setInstallingUpdateFromPrompt(false);
                    setUpdateStatus("Update download failed. Try again later.");
                  }
                }}
              >
                {installingUpdateFromPrompt ? "Installing…" : "Install update"}
              </button>
              {releaseUrl && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    window.electronAPI?.openExternal?.(releaseUrl);
                    markUpdatePromptSeen();
                  }}
                >
                  View details
                </button>
              )}
              <button
                type="button"
                className="ghost-button"
                onClick={markUpdatePromptSeen}
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
      <AddSongsProgress />
      <LikedSongToast />
      {dragActive && (
        <DragAddToPlaylistOverlay
          trackIds={draggingTrackIds}
          onClose={() => setDraggingTrackIds([])}
        />
      )}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
};
