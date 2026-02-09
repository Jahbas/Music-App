import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useThemeStore } from "../stores/themeStore";
import { usePlayHistoryStore } from "../stores/playHistoryStore";
import { useLibraryStore } from "../stores/libraryStore";
import { usePlaylistStore } from "../stores/playlistStore";
import { useProfileStore } from "../stores/profileStore";
import { useFolderStore } from "../stores/folderStore";
import { useProfileLikesStore } from "../stores/profileLikesStore";
import { usePlayerStore } from "../stores/playerStore";
import { useAudioSettingsStore } from "../stores/audioSettingsStore";
import type { EqPresetId } from "../stores/audioSettingsStore";
import { EqAdvancedGraph } from "./EqAdvancedGraph";
import { exportSettingsToJson, importSettingsFromJson } from "../utils/settingsBackup";
import { trackDb, playlistDb, folderDb, imageDb, playHistoryDb, themeDb, profileDb, profileLikesDb, artistCacheDb, audioBlobDb, sharedTrackDb } from "../db/db";
import {
  getExpandPlaylistsOnFolderPlay,
  setExpandPlaylistsOnFolderPlay,
  getAutoPlayOnLoad,
  setAutoPlayOnLoad,
  getTelemetryEnabled,
  setTelemetryEnabled,
  getArtistDataPersistent,
  setArtistDataPersistent,
  getMinimizeToTray,
  setMinimizeToTray,
  getAutoUpdateEnabled,
  setAutoUpdateEnabled,
} from "../utils/preferences";
import { useArtistStore } from "../stores/artistStore";
import { KeybindsTab } from "./KeybindsTab";
import { ColorPicker } from "./ColorPicker";
import { useUpdateStore } from "../stores/updateStore";

const OLED_UNLOCK_KEY = "oled-mode-unlocked";
const OLED_UNLOCK_TAPS = 10;
const OLED_HINT_AFTER_TAPS = 3;
const GITHUB_REPO_URL = "https://github.com/Jahbas/Music";
const GITHUB_ELECTRON_REPO_URL = "https://github.com/Jahbas/Music-App";

function getOledUnlocked(): boolean {
  try {
    return localStorage.getItem(OLED_UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

type SettingsSwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  title?: string;
  "aria-label"?: string;
};

function SettingsSwitch({ checked, onChange, title, "aria-label": ariaLabel }: SettingsSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? (checked ? "On" : "Off")}
      title={title}
      className={`settings-switch ${checked ? "settings-switch--on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="settings-switch-fill" aria-hidden />
      <span className="settings-switch-thumb" aria-hidden />
    </button>
  );
}

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  type SettingsTabId = "general" | "appearance" | "profiles" | "audio" | "player" | "keybinds" | "data" | "support";

  const SETTINGS_TABS: { id: SettingsTabId; label: string }[] = [
    { id: "general", label: "General" },
    { id: "appearance", label: "Appearance" },
    { id: "profiles", label: "Profiles" },
    { id: "audio", label: "Audio" },
    { id: "player", label: "Player" },
    { id: "keybinds", label: "Keybinds" },
    { id: "data", label: "Data & privacy" },
    { id: "support", label: "Support" },
  ];

  const navigate = useNavigate();
  const mode = useThemeStore((state) => state.mode);
  const accent = useThemeStore((state) => state.accent);
  const density = useThemeStore((state) => state.density);
  const motion = useThemeStore((state) => state.motion);
  const profiles = useThemeStore((state) => state.profiles);
  const setMode = useThemeStore((state) => state.setMode);
  const setAccent = useThemeStore((state) => state.setAccent);
  const setDensity = useThemeStore((state) => state.setDensity);
  const setMotion = useThemeStore((state) => state.setMotion);
  const saveThemeProfile = useThemeStore((state) => state.saveProfile);
  const applyThemeProfile = useThemeStore((state) => state.applyProfile);
  const deleteThemeProfile = useThemeStore((state) => state.deleteProfile);
  const clearPlayHistory = usePlayHistoryStore((state) => state.clearPlayHistory);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [confirmDeleteAllSongs, setConfirmDeleteAllSongs] = useState(false);
  const [confirmClearArtistData, setConfirmClearArtistData] = useState(false);
  const [artistDataPersistent, setArtistDataPersistentState] = useState(false);
  const [storageUsage, setStorageUsage] = useState<string | null>(null);
  const [dataInfoHover, setDataInfoHover] = useState(false);
  const [oledUnlocked, setOledUnlocked] = useState(false);
  const [darkTapCount, setDarkTapCount] = useState(0);
  const [expandPlaylistsOnFolderPlay, setExpandPlaylistsOnFolderPlayState] = useState(true);
  const [autoPlayOnLoad, setAutoPlayOnLoadState] = useState(true);
  const [runOnStartup, setRunOnStartupState] = useState(false);
  const [minimizeToTray, setMinimizeToTrayState] = useState(false);
  const [telemetryEnabled, setTelemetryEnabledState] = useState(false);
  const [isImportingSettings, setIsImportingSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTabId>("general");
  const [isEqPresetOpen, setIsEqPresetOpen] = useState(false);
  const [showAdvancedEq, setShowAdvancedEq] = useState(false);
  const eqPresetDropdownRef = useRef<HTMLDivElement | null>(null);
  const [autoUpdateEnabled, setAutoUpdateEnabledState] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const updateCurrentVersion = useUpdateStore((s) => s.currentVersion);
  const updateLatestVersion = useUpdateStore((s) => s.latestVersion);
  const updateNotesPreview = useUpdateStore((s) => s.notesPreview);
  const updateReleaseUrl = useUpdateStore((s) => s.releaseUrl);
  const updateDownloadUrl = useUpdateStore((s) => s.downloadUrl);
  const updateHasUpdate = useUpdateStore((s) => s.hasUpdate);
  const updateStatus = useUpdateStore((s) => s.status);
  const checkingUpdate = useUpdateStore((s) => s.isChecking);
  const updateCooldownSeconds = useUpdateStore((s) => s.cooldownSecondsRemaining);
  const runCheckForUpdates = useUpdateStore((s) => s.checkForUpdates);
  const decrementUpdateCooldown = useUpdateStore((s) => s.decrementCooldown);
  const clearUpdateStatus = useUpdateStore((s) => s.clearStatus);
  const setUpdateStatus = useUpdateStore((s) => s.setStatus);

  const EQ_PRESETS: { id: EqPresetId; label: string }[] = [
    { id: "flat", label: "Flat" },
    { id: "bassBoost", label: "Bass boost" },
    { id: "trebleBoost", label: "Treble boost" },
    { id: "vocal", label: "Vocal" },
    { id: "loudness", label: "Loudness" },
  ];

  const crossfadeEnabled = useAudioSettingsStore((s) => s.crossfadeEnabled);
  const crossfadeMs = useAudioSettingsStore((s) => s.crossfadeMs);
  const gaplessEnabled = useAudioSettingsStore((s) => s.gaplessEnabled);
  const eqEnabled = useAudioSettingsStore((s) => s.eqEnabled);
  const eqPresetId = useAudioSettingsStore((s) => s.eqPresetId);
  const eqBands = useAudioSettingsStore((s) => s.eqBands);
  const setCrossfadeEnabled = useAudioSettingsStore((s) => s.setCrossfadeEnabled);
  const setCrossfadeMs = useAudioSettingsStore((s) => s.setCrossfadeMs);
  const setGaplessEnabled = useAudioSettingsStore((s) => s.setGaplessEnabled);
  const setEqEnabled = useAudioSettingsStore((s) => s.setEqEnabled);
  const setEqPresetId = useAudioSettingsStore((s) => s.setEqPresetId);
  const setEqBands = useAudioSettingsStore((s) => s.setEqBands);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const setShuffle = usePlayerStore((s) => s.setShuffle);
  const setRepeat = usePlayerStore((s) => s.setRepeat);

  useEffect(() => {
    if (!isOpen) {
      setConfirmClearHistory(false);
      setConfirmDeleteAllSongs(false);
      return;
    }
    setActiveTab("general");
    setOledUnlocked(getOledUnlocked());
    setDarkTapCount(0);
    setExpandPlaylistsOnFolderPlayState(getExpandPlaylistsOnFolderPlay());
    setAutoPlayOnLoadState(getAutoPlayOnLoad());
    setTelemetryEnabledState(getTelemetryEnabled());
    setMinimizeToTrayState(getMinimizeToTray());
    const loadRunOnStartup = async () => {
      const open = await window.electronAPI?.getRunOnStartup?.();
      if (typeof open === "boolean") setRunOnStartupState(open);
    };
    void loadRunOnStartup();
    setAutoUpdateEnabledState(getAutoUpdateEnabled());
    clearUpdateStatus();
    setArtistDataPersistentState(getArtistDataPersistent());
    setConfirmClearArtistData(false);
    const getStorageUsage = async () => {
      try {
        if (navigator.storage?.estimate) {
          const { usage } = await navigator.storage.estimate();
          if (usage != null) {
            const mb = usage / (1024 * 1024);
            setStorageUsage(mb >= 1 ? `${mb.toFixed(2)} MB` : `${(usage / 1024).toFixed(2)} KB`);
          } else {
            setStorageUsage("—");
          }
        } else {
          setStorageUsage("—");
        }
      } catch {
        setStorageUsage("—");
      }
    };
    void getStorageUsage();
  }, [isOpen, clearUpdateStatus]);

  useEffect(() => {
    if (updateCooldownSeconds <= 0) return;
    const id = window.setInterval(() => {
      decrementUpdateCooldown(1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [updateCooldownSeconds, decrementUpdateCooldown]);

  useEffect(() => {
    if (!isEqPresetOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (eqPresetDropdownRef.current && !eqPresetDropdownRef.current.contains(event.target as Node)) {
        setIsEqPresetOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEqPresetOpen]);

  const handleOpenWrapped = () => {
    onClose();
    navigate("/wrapped");
  };

  const handleOpenTelemetry = () => {
    onClose();
    navigate("/telemetry");
  };

  const clearArtistCache = useArtistStore((s) => s.clearCache);

  const handleClearPlayHistory = async () => {
    if (!confirmClearHistory) {
      setConfirmClearHistory(true);
      return;
    }
    await clearPlayHistory();
    setConfirmClearHistory(false);
    onClose();
  };

  const handleClearArtistData = async () => {
    if (!confirmClearArtistData) {
      setConfirmClearArtistData(true);
      return;
    }
    await clearArtistCache();
    await artistCacheDb.clear();
    setConfirmClearArtistData(false);
  };

  const handleArtistDataPersistentChange = (value: boolean) => {
    setArtistDataPersistent(value);
    setArtistDataPersistentState(value);
  };

  const handleDeleteAllSongs = async () => {
    if (!confirmDeleteAllSongs) {
      setConfirmDeleteAllSongs(true);
      return;
    }
    try {
      await trackDb.clear();
      await playlistDb.clear();
      await folderDb.clear();
      await imageDb.clear();
      await playHistoryDb.clear();
      await profileLikesDb.clear();
      await artistCacheDb.clear();
      await audioBlobDb.clear();
      await sharedTrackDb.clear();
      await useArtistStore.getState().clearCache();
      await useLibraryStore.getState().hydrate();
      await usePlaylistStore.getState().hydrate();
      await useFolderStore.getState().hydrate();
      await usePlayHistoryStore.getState().hydrate();
      await useProfileLikesStore.getState().hydrate();
      usePlayerStore.getState().clearQueue();
      // Theme and profiles are not cleared.
    } finally {
      setConfirmDeleteAllSongs(false);
      onClose();
    }
  };

  const [confirmDeleteUnusedTracks, setConfirmDeleteUnusedTracks] = useState(false);
  const [lastUnusedDeleteCount, setLastUnusedDeleteCount] = useState<number | null>(null);
  const [isSavingThemeProfile, setIsSavingThemeProfile] = useState(false);
  const [newThemeProfileName, setNewThemeProfileName] = useState("");

  const handleDeleteUnusedTracks = async () => {
    const libraryState = useLibraryStore.getState();
    const playlistState = usePlaylistStore.getState();
    const playerState = usePlayerStore.getState();

    const allTracks = libraryState.tracks;
    // Use DB as source of truth so every playlist is considered (including playlists in folders).
    const playlists = await playlistDb.getAll();

    const usedTrackIds = new Set<string>();
    for (const playlist of playlists) {
      for (const id of playlist.trackIds) {
        usedTrackIds.add(id);
      }
    }
    for (const id of playerState.queue) {
      usedTrackIds.add(id);
    }
    if (playerState.currentTrackId) {
      usedTrackIds.add(playerState.currentTrackId);
    }

    const unusedTrackIds = allTracks
      .map((t) => t.id)
      .filter((id) => !usedTrackIds.has(id));

    if (!confirmDeleteUnusedTracks) {
      setLastUnusedDeleteCount(unusedTrackIds.length);
      setConfirmDeleteUnusedTracks(true);
      return;
    }

    for (const id of unusedTrackIds) {
      // removeTrack updates both IndexedDB and in-memory library state
      // and will no-op if the track was already removed.
      // eslint-disable-next-line no-await-in-loop
      await libraryState.removeTrack(id);
    }

    // Remove deleted track IDs from all playlists (including those in folders) so we don't leave stale references.
    if (unusedTrackIds.length > 0) {
      await playlistState.removeTrackIdsFromAllPlaylists(unusedTrackIds);
    }

    setConfirmDeleteUnusedTracks(false);
    setLastUnusedDeleteCount(null);
    await libraryState.hydrate();
  };

  const openExternalUrl = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    window.electronAPI?.openExternal(trimmed);
  };

  const handleOpenGitHubStar = () => {
    openExternalUrl(GITHUB_REPO_URL);
  };

  const handleOpenGitHubElectronRepo = () => {
    openExternalUrl(GITHUB_ELECTRON_REPO_URL);
  };

  if (!isOpen) {
    return null;
  }

  const renderGeneralTab = () => (
    <div className="settings-sections">
      <section className="settings-section">
        <h4 className="settings-section-title">App</h4>
        {typeof window.electronAPI?.getRunOnStartup === "function" && (
          <div className="settings-row">
            <span className="settings-row-label">Run on startup</span>
            <SettingsSwitch
              checked={runOnStartup}
              onChange={async (next) => {
                await window.electronAPI?.setRunOnStartup?.(next);
                setRunOnStartupState(next);
              }}
              title="Start Music when you log in"
            />
          </div>
        )}
        {typeof window.electronAPI?.setMinimizeToTray === "function" && (
          <div className="settings-row">
            <span className="settings-row-label">Minimize to tray on close</span>
            <SettingsSwitch
              checked={minimizeToTray}
              onChange={(next) => {
                setMinimizeToTray(next);
                setMinimizeToTrayState(next);
                window.electronAPI?.setMinimizeToTray?.(next);
              }}
              title="Hide to tray instead of quitting"
            />
          </div>
        )}
        <div className="settings-row">
          <span className="settings-row-label">Check for updates automatically</span>
          <SettingsSwitch
            checked={autoUpdateEnabled}
            onChange={(next) => {
              setAutoUpdateEnabled(next);
              setAutoUpdateEnabledState(next);
            }}
            title="On app start, check GitHub for a new version"
          />
        </div>
        {typeof window.electronAPI?.checkForUpdates === "function" && (
          <>
            <div className="settings-row">
              <span className="settings-row-label">
                Version{" "}
                {updateCurrentVersion ?? "—"}
                {updateLatestVersion && updateLatestVersion !== updateCurrentVersion
                  ? ` → ${updateLatestVersion}`
                  : ""}
              </span>
              <div className="settings-theme-toggle">
                <button
                  type="button"
                  className="secondary-button settings-row-action"
                  onClick={async () => {
                    await runCheckForUpdates({ manual: true });
                  }}
                  disabled={checkingUpdate || updateCooldownSeconds > 0}
                  title="Check GitHub Releases for a new desktop version"
                >
                  {checkingUpdate
                    ? "Checking…"
                    : updateCooldownSeconds > 0
                    ? `Try again in ${updateCooldownSeconds}s`
                    : "Check for updates"}
                </button>
              </div>
            </div>
            {updateStatus && (
              <div className="settings-row">
                <span className="settings-row-label" />
                <span className="settings-row-label">{updateStatus}</span>
              </div>
            )}
            {updateHasUpdate && (
              <div className="settings-row">
                <span className="settings-row-label">Update</span>
                <div
                  className="settings-theme-toggle"
                  style={{ flexDirection: "column", alignItems: "flex-start" }}
                >
                  <span className="settings-row-label">
                    New version: {updateLatestVersion ?? "—"}
                  </span>
                  {updateNotesPreview && (
                    <p
                      className="settings-info-body"
                      style={{ marginTop: 4, maxWidth: 420, whiteSpace: "pre-wrap" }}
                    >
                      {updateNotesPreview}
                    </p>
                  )}
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="primary-button settings-row-action"
                      disabled={
                        installingUpdate ||
                        !updateDownloadUrl ||
                        typeof window.electronAPI?.downloadAndRunUpdate !== "function"
                      }
                      onClick={async () => {
                        if (!updateDownloadUrl || !window.electronAPI?.downloadAndRunUpdate) return;
                        setInstallingUpdate(true);
                        setUpdateStatus("Downloading update and restarting…");
                        try {
                          await window.electronAPI.downloadAndRunUpdate(updateDownloadUrl);
                        } catch {
                          setInstallingUpdate(false);
                          setUpdateStatus("Update download failed. Try again later.");
                        }
                      }}
                    >
                      {installingUpdate ? "Installing…" : "Install update"}
                    </button>
                    {updateReleaseUrl && (
                      <button
                        type="button"
                        className="secondary-button settings-row-action"
                        onClick={() => openExternalUrl(updateReleaseUrl)}
                      >
                        View on GitHub
                      </button>
                    )}
                  </div>
                  {!updateDownloadUrl && (
                    <span className="settings-row-label" style={{ marginTop: 4 }}>
                      Update found, but no Windows installer asset was detected. Use “View on GitHub” to
                      download manually.
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
        <div className="settings-row">
          <span className="settings-row-label">Your Wrapped</span>
          <button
            type="button"
            className="secondary-button settings-row-action"
            onClick={handleOpenWrapped}
            title="Yearly listening stats"
          >
            Open
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h4 className="settings-section-title">Library</h4>
        <div className="settings-row">
          <span className="settings-row-label">Expand playlists when playing folder</span>
          <SettingsSwitch
            checked={expandPlaylistsOnFolderPlay}
            onChange={(next) => {
              setExpandPlaylistsOnFolderPlayState(next);
              setExpandPlaylistsOnFolderPlay(next);
            }}
            title="Play on folder expands all playlists inside"
          />
        </div>
      </section>
    </div>
  );

  const renderAppearanceTab = () => (
    <div className="settings-sections">
      <section className="settings-section">
        <h4 className="settings-section-title">Theme</h4>
        <div className="settings-row">
          <span className="settings-row-label">Mode</span>
          <div className="settings-theme-toggle-wrap">
            <div className="settings-theme-toggle">
              {oledUnlocked && (
                <button
                  type="button"
                  className={`${mode === "oled" ? "primary-button" : "secondary-button"} settings-toggle-btn`}
                  onClick={() => setMode("oled")}
                >
                  OLED
                </button>
              )}
              <button
                type="button"
                className={`${mode === "dark" ? "primary-button" : "secondary-button"} settings-toggle-btn`}
                onClick={() => {
                  setMode("dark");
                  const next = darkTapCount + 1;
                  setDarkTapCount(next);
                  if (next >= OLED_UNLOCK_TAPS) {
                    try {
                      localStorage.setItem(OLED_UNLOCK_KEY, "1");
                      setOledUnlocked(true);
                    } catch {
                      // ignore
                    }
                  }
                }}
              >
                Dark
              </button>
              <button
                type="button"
                className={`${mode === "light" ? "primary-button" : "secondary-button"} settings-toggle-btn`}
                onClick={() => setMode("light")}
              >
                Light
              </button>
            </div>
            {!oledUnlocked && darkTapCount >= OLED_HINT_AFTER_TAPS && darkTapCount < OLED_UNLOCK_TAPS && (
              <span className="settings-oled-hint">
                {OLED_UNLOCK_TAPS - darkTapCount} more to unlock OLED
              </span>
            )}
          </div>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Accent</span>
          <ColorPicker
            value={accent}
            onChange={setAccent}
            ariaLabel="Accent color"
          />
        </div>
      </section>

      <section className="settings-section">
        <h4 className="settings-section-title">Layout</h4>
        <div className="settings-row">
          <span className="settings-row-label">Density</span>
          <div className="settings-theme-toggle">
            <button
              type="button"
              className={`${density === "cozy" ? "primary-button" : "secondary-button"} settings-toggle-btn`}
              onClick={() => setDensity("cozy")}
            >
              Cozy
            </button>
            <button
              type="button"
              className={`${density === "compact" ? "primary-button" : "secondary-button"} settings-toggle-btn`}
              onClick={() => setDensity("compact")}
            >
              Compact
            </button>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h4 className="settings-section-title">Motion</h4>
        <div className="settings-row">
          <span className="settings-row-label">Reduce motion</span>
          <SettingsSwitch
            checked={motion === "reduced"}
            onChange={(on) => setMotion(on ? "reduced" : "normal")}
            aria-label="Reduce motion"
          />
        </div>
      </section>
    </div>
  );

  const renderProfilesTab = () => (
    <div className="settings-sections">
      <section className="settings-section">
        <h4 className="settings-section-title">Profiles</h4>
        <div className="settings-row">
          <span className="settings-row-label">Save current setup</span>
          <button
            type="button"
            className="secondary-button settings-row-action"
            onClick={() => {
              setNewThemeProfileName("");
              setIsSavingThemeProfile(true);
            }}
            title="Theme, audio, player & preferences"
          >
            Save
          </button>
        </div>
        {isSavingThemeProfile && (
          <div
            className="settings-section"
            role="dialog"
            aria-modal="true"
            aria-label="Save profile"
          >
            <div className="form">
              <label>
                Name
                <input
                  type="text"
                  value={newThemeProfileName}
                  onChange={(event) => setNewThemeProfileName(event.target.value)}
                  autoFocus
                />
              </label>
              <div className="form-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    const trimmed = newThemeProfileName.trim();
                    if (!trimmed) {
                      return;
                    }
                    saveThemeProfile(trimmed);
                    setIsSavingThemeProfile(false);
                    setNewThemeProfileName("");
                  }}
                >
                  Save profile
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setIsSavingThemeProfile(false);
                    setNewThemeProfileName("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {profiles.length > 0 && (
        <section className="settings-section">
          <h4 className="settings-section-title">Saved</h4>
          <div className="settings-theme-profiles-list">
            {profiles.map((profile) => (
              <div key={(profile as any).name ?? profile.mode} className="settings-row">
                <span className="settings-row-label">
                  {(profile as any).name ?? "Profile"}
                </span>
                <div className="settings-theme-toggle">
                  <button
                    type="button"
                    className="secondary-button settings-toggle-btn"
                    onClick={() => applyThemeProfile((profile as any).name ?? "")}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    className="ghost-button settings-row-action settings-row-action-icon"
                    onClick={() => deleteThemeProfile((profile as any).name ?? "")}
                    aria-label={`Delete ${(profile as any).name ?? ""}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );

  const renderAudioTab = () => (
    <div className="settings-sections">
      <section className="settings-section">
        <h4 className="settings-section-title">Playback</h4>
        <div className="settings-row">
          <span className="settings-row-label">
            Crossfade
            <span
              className="settings-experimental-icon"
              title="Experimental. Report issues on GitHub."
              aria-label="Experimental"
            >
              !
            </span>
          </span>
          <SettingsSwitch
            checked={crossfadeEnabled}
            onChange={setCrossfadeEnabled}
            aria-label="Crossfade"
          />
        </div>
        <div className="settings-row settings-row-slider">
          <span className="settings-row-label">Crossfade length</span>
          <div className="settings-slider-wrap" style={{ ["--settings-crossfade-fill" as string]: `${(crossfadeMs / 12000) * 100}%` }}>
            <input
              className="settings-slider-input"
              type="range"
              min={0}
              max={12000}
              step={500}
              value={crossfadeMs}
              onChange={(event) => setCrossfadeMs(Number(event.target.value))}
              aria-label="Crossfade duration"
            />
            <span className="settings-slider-value">
              {crossfadeMs === 0 ? "Off" : `${(crossfadeMs / 1000).toFixed(1)} s`}
            </span>
          </div>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Gapless</span>
          <SettingsSwitch
            checked={gaplessEnabled}
            onChange={setGaplessEnabled}
            title="Minimize gaps between tracks"
          />
        </div>
      </section>

      <section className="settings-section">
        <h4 className="settings-section-title">Equalizer</h4>
        <div className="settings-row">
          <span className="settings-row-label">EQ</span>
          <SettingsSwitch
            checked={eqEnabled}
            onChange={setEqEnabled}
            aria-label="Equalizer"
          />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Preset</span>
          <div className="settings-select-wrap">
            <div className="form-select" ref={eqPresetDropdownRef}>
              <button
                type="button"
                className="form-select-trigger"
                onClick={() => setIsEqPresetOpen((previous) => !previous)}
                aria-haspopup="listbox"
                aria-expanded={isEqPresetOpen}
                aria-label="Equalizer preset"
              >
                <span className="form-select-value">
                  {EQ_PRESETS.find((preset) => preset.id === eqPresetId)?.label ?? "Flat"}
                </span>
                <span className="form-select-chevron" aria-hidden>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </button>
              {isEqPresetOpen && (
                <div className="form-select-menu" role="listbox">
                  {EQ_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`form-select-option ${
                        preset.id === eqPresetId ? "form-select-option--selected" : ""
                      }`}
                      onClick={() => {
                        setEqPresetId(preset.id);
                        setIsEqPresetOpen(false);
                      }}
                      role="option"
                      aria-selected={preset.id === eqPresetId}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Advanced</span>
          <button
            type="button"
            className={`${showAdvancedEq ? "primary-button" : "secondary-button"} settings-row-action`}
            onClick={() => setShowAdvancedEq(!showAdvancedEq)}
            aria-pressed={showAdvancedEq}
          >
            {showAdvancedEq ? "Hide" : "Show"}
          </button>
        </div>
        {showAdvancedEq && (
          <EqAdvancedGraph
            bands={eqBands}
            onChangeBands={setEqBands}
            onResetToPreset={() => {
              setEqPresetId(eqPresetId);
            }}
          />
        )}
      </section>
    </div>
  );

  const renderDataTab = () => (
    <div className="settings-sections">
      <section className="settings-section">
        <h4 className="settings-section-title">Privacy</h4>
        <div className="settings-row">
          <span className="settings-row-label">Usage telemetry</span>
          <SettingsSwitch
            checked={telemetryEnabled}
            onChange={(next) => {
              setTelemetryEnabled(next);
              setTelemetryEnabledState(next);
            }}
            title="Local-only: visits, listening, searches. Stays on device."
          />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Telemetry details</span>
          <button
            type="button"
            className="secondary-button settings-row-action"
            onClick={handleOpenTelemetry}
            title="View and export analytics"
          >
            Open
          </button>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-title-row">
          <h4 className="settings-section-title">Storage</h4>
          <span
            className="settings-info-icon"
            onMouseEnter={() => setDataInfoHover(true)}
            onMouseLeave={() => setDataInfoHover(false)}
            aria-label="Storage info"
          >
            i
          </span>
        </div>
        {dataInfoHover && (
          <div
            className="settings-info-panel settings-info-panel--data"
            role="tooltip"
            onMouseEnter={() => setDataInfoHover(true)}
            onMouseLeave={() => setDataInfoHover(false)}
          >
            <p className="settings-info-title">Local storage</p>
            <p className="settings-info-body">
              Tracks, playlists, profiles, history and settings are stored only on this device. Nothing is sent to any server.
            </p>
            {storageUsage != null && (
              <p className="settings-info-meta">
                <span className="settings-info-meta-label">Used:</span> {storageUsage}
              </p>
            )}
          </div>
        )}
        <div className="settings-row">
          <span className="settings-row-label">Export settings</span>
          <button
            type="button"
            className="secondary-button settings-row-action"
            onClick={() => {
              const json = exportSettingsToJson();
              const blob = new Blob([json], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = "music-settings.json";
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }}
            title="Theme, audio, player, folders & playlists to JSON"
          >
            Download
          </button>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Import settings</span>
          <button
            type="button"
            className="secondary-button settings-row-action"
            disabled={isImportingSettings}
            onClick={() => {
              setIsImportingSettings(true);
              if (fileInputRef.current) {
                fileInputRef.current.click();
              }
            }}
            title="From Music JSON backup (no tracks)"
          >
            Choose file
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) {
              setIsImportingSettings(false);
              return;
            }
            try {
              const text = await file.text();
              await importSettingsFromJson(text);
            } catch {
              // ignore invalid files
            } finally {
              setIsImportingSettings(false);
              event.target.value = "";
            }
          }}
        />
      </section>

      <section className="settings-section">
        <h4 className="settings-section-title">Artists</h4>
        <div className="settings-row">
          <span className="settings-row-label">Persist artist data</span>
          <SettingsSwitch
            checked={artistDataPersistent}
            onChange={handleArtistDataPersistentChange}
            title="Save to device across restarts"
          />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Clear artist cache</span>
          <button
            type="button"
            className={confirmClearArtistData ? "danger-button settings-row-action" : "secondary-button settings-row-action"}
            onClick={handleClearArtistData}
          >
            {confirmClearArtistData ? "Click again" : "Clear"}
          </button>
        </div>
      </section>

      <section className="settings-section modal-danger-zone">
        <h4 className="settings-section-title">Danger zone</h4>
        <div className="settings-row">
          <span className="settings-row-label">Play history</span>
          <button
            type="button"
            className={confirmClearHistory ? "danger-button settings-row-action" : "secondary-button settings-row-action"}
            onClick={handleClearPlayHistory}
          >
            {confirmClearHistory ? "Click again" : "Clear"}
          </button>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Delete unused tracks</span>
          <button
            type="button"
            className={confirmDeleteUnusedTracks ? "danger-button settings-row-action" : "secondary-button settings-row-action"}
            onClick={handleDeleteUnusedTracks}
          >
            {confirmDeleteUnusedTracks
              ? lastUnusedDeleteCount != null && lastUnusedDeleteCount > 0
                ? `Again: ${lastUnusedDeleteCount}`
                : "Click again"
              : "Delete"}
          </button>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Delete all songs</span>
          <button
            type="button"
            className={confirmDeleteAllSongs ? "danger-button settings-row-action" : "secondary-button settings-row-action"}
            onClick={handleDeleteAllSongs}
          >
            {confirmDeleteAllSongs ? "Click again" : "Delete all"}
          </button>
        </div>
      </section>
    </div>
  );

  const renderSupportTab = () => (
    <div className="settings-sections">
      <section className="settings-section">
        <h4 className="settings-section-title">Support</h4>
        <div className="settings-row">
          <span className="settings-row-label">Repository</span>
          <button
            type="button"
            className="secondary-button settings-row-action support-rainbow-button"
            onClick={handleOpenGitHubElectronRepo}
            title={GITHUB_ELECTRON_REPO_URL}
            aria-label="Open repository"
          >
            Open
          </button>
        </div>
      </section>
    </div>
  );

  const renderPlayerTab = () => (
    <div className="settings-sections">
      <section className="settings-section">
        <h4 className="settings-section-title">Defaults</h4>
        <div className="settings-row">
          <span className="settings-row-label">Shuffle</span>
          <SettingsSwitch
            checked={shuffle}
            onChange={setShuffle}
            title="New queues start shuffled"
          />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Repeat</span>
          <div className="settings-theme-toggle">
            <button
              type="button"
              className={`${repeat === "off" ? "primary-button" : "secondary-button"} settings-toggle-btn`}
              onClick={() => setRepeat("off")}
            >
              Off
            </button>
            <button
              type="button"
              className={`${repeat === "queue" ? "primary-button" : "secondary-button"} settings-toggle-btn`}
              onClick={() => setRepeat("queue")}
            >
              Queue
            </button>
            <button
              type="button"
              className={`${repeat === "track" ? "primary-button" : "secondary-button"} settings-toggle-btn`}
              onClick={() => setRepeat("track")}
            >
              Track
            </button>
          </div>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Resume on load</span>
          <SettingsSwitch
            checked={autoPlayOnLoad}
            onChange={(next) => {
              setAutoPlayOnLoadState(next);
              setAutoPlayOnLoad(next);
            }}
            title="Resume last track when opening app"
          />
        </div>
      </section>
    </div>
  );

  let content: JSX.Element;
  if (activeTab === "general") {
    content = renderGeneralTab();
  } else if (activeTab === "appearance") {
    content = renderAppearanceTab();
  } else if (activeTab === "profiles") {
    content = renderProfilesTab();
  } else if (activeTab === "audio") {
    content = renderAudioTab();
  } else if (activeTab === "player") {
    content = renderPlayerTab();
  } else if (activeTab === "data") {
    content = renderDataTab();
  } else if (activeTab === "keybinds") {
    content = <KeybindsTab />;
  } else {
    content = renderSupportTab();
  }

  return (
    <div className="settings-fullscreen-backdrop" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="settings-fullscreen">
        <header className="settings-fullscreen-header">
          <div>
            <h2 className="settings-fullscreen-title">Settings</h2>
            <p className="settings-fullscreen-subtitle">
              Look, sound, data.
            </p>
          </div>
          <button
            type="button"
            className="ghost-button settings-fullscreen-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            ✕
          </button>
        </header>
        <div className="settings-fullscreen-body">
          <nav className="settings-tabs" aria-label="Settings sections">
            {SETTINGS_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const isSupport = tab.id === "support";
              const classes = [
                "settings-tab",
                isActive ? "settings-tab--active" : "",
                isSupport ? "settings-tab--support" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  key={tab.id}
                  type="button"
                  className={classes}
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={isActive ? "page" : undefined}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
          <main className="settings-content">
            {content}
          </main>
        </div>
      </div>
    </div>
  );
};
