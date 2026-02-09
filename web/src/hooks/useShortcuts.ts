import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore } from "../stores/playerStore";
import { useKeybindStore } from "../stores/keybindStore";
import type { KeybindAction } from "../types";
import { normalizeKeyComboFromEvent } from "../utils/keybinds";

export const useShortcuts = () => {
  const navigate = useNavigate();
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const next = usePlayerStore((s) => s.next);
  const previous = usePlayerStore((s) => s.previous);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const volume = usePlayerStore((s) => s.volume);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const keybinds = useKeybindStore((s) => s.keybinds);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (isInput) return;

      const combo = normalizeKeyComboFromEvent(event);
      if (!combo) return;

      const matchedActions: KeybindAction[] = [];
      for (const [action, combos] of Object.entries(keybinds) as [KeybindAction, string[]][]) {
        if (Array.isArray(combos) && combos.includes(combo)) {
          matchedActions.push(action);
        }
      }

      if (matchedActions.length === 0) {
        return;
      }

      const shouldPreventDefault = matchedActions.some((action) =>
        action === "playPause" ||
        action === "volumeUp" ||
        action === "volumeDown" ||
        action === "openSearchOverlay"
      );
      if (shouldPreventDefault) {
        event.preventDefault();
      }

      for (const action of matchedActions) {
        if (action === "playPause") {
          togglePlay();
        } else if (action === "nextTrack") {
          next();
        } else if (action === "previousTrack") {
          previous();
        } else if (action === "volumeUp") {
          setVolume(Math.min(1, volume + 0.05));
        } else if (action === "volumeDown") {
          setVolume(Math.max(0, volume - 0.05));
        } else if (action === "toggleShuffle") {
          toggleShuffle();
        } else if (action === "cycleRepeat") {
          cycleRepeat();
        } else if (action === "openSearchOverlay") {
          // Open the global search overlay instead of navigating to the search view
          window.dispatchEvent(new CustomEvent("open-global-search"));
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate, togglePlay, next, previous, toggleShuffle, cycleRepeat, volume, setVolume, keybinds]);
};

