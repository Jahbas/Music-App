import { useEffect } from "react";
import type { KeybindAction } from "../types";
import { useKeybindStore } from "../stores/keybindStore";
import { ShortcutCapture } from "./ShortcutCapture";
import { DEFAULT_KEYBINDS } from "../config/defaultKeybinds";

type ActionDefinition = {
  id: KeybindAction;
  label: string;
  description?: string;
};

const ACTION_DEFINITIONS: ActionDefinition[] = [
  {
    id: "playPause",
    label: "Play / pause",
    description: "Toggle playback of the current track.",
  },
  {
    id: "nextTrack",
    label: "Next track",
  },
  {
    id: "previousTrack",
    label: "Previous track",
  },
  {
    id: "volumeUp",
    label: "Volume up",
  },
  {
    id: "volumeDown",
    label: "Volume down",
  },
  {
    id: "toggleShuffle",
    label: "Toggle shuffle",
  },
  {
    id: "cycleRepeat",
    label: "Cycle repeat mode",
  },
  {
    id: "openSearchOverlay",
    label: "Open search",
    description: "Show the global search overlay.",
  },
];

export const KeybindsTab = () => {
  const keybinds = useKeybindStore((state) => state.keybinds);
  const hydrateFromProfiles = useKeybindStore((state) => state.hydrateFromProfiles);
  const addKeybind = useKeybindStore((state) => state.addKeybind);
  const clearKeybinds = useKeybindStore((state) => state.clearKeybinds);
  const resetToDefaults = useKeybindStore((state) => state.resetToDefaults);

  useEffect(() => {
    void hydrateFromProfiles();
  }, [hydrateFromProfiles]);

  const hasCustomizations =
    JSON.stringify(keybinds) !== JSON.stringify(DEFAULT_KEYBINDS);

  return (
    <div className="settings-sections">
      <section className="settings-section">
        <h4 className="settings-section-title">Keybinds</h4>
        <p className="settings-info-body">
          Set keyboard shortcuts for playback controls. Press ESC while capturing to clear a keybind.
        </p>
        <div className="settings-row">
          <span className="settings-row-label">Defaults</span>
          <button
            type="button"
            className="secondary-button settings-row-action"
            disabled={!hasCustomizations}
            onClick={resetToDefaults}
            title="Reset all keybinds back to their defaults"
          >
            Reset to defaults
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h4 className="settings-section-title">Playback</h4>
        {ACTION_DEFINITIONS.map((action) => {
          const combos = keybinds[action.id] ?? [];
          return (
            <div key={action.id} className="settings-row">
              <div className="settings-row-label">
                <div>{action.label}</div>
                {action.description && (
                  <div className="settings-info-body">{action.description}</div>
                )}
              </div>
              <div className="settings-theme-toggle">
                <ShortcutCapture
                  label="Add shortcut"
                  value={combos}
                  onAdd={(combo) => addKeybind(action.id, combo)}
                  onClear={() => clearKeybinds(action.id)}
                />
                {combos.length > 0 && (
                  <button
                    type="button"
                    className="ghost-button settings-row-action settings-row-action-icon"
                    onClick={() => clearKeybinds(action.id)}
                    aria-label={`Clear keybinds for ${action.label}`}
                    title="Clear keybinds"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
};

