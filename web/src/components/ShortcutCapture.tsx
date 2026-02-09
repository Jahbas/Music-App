import { useEffect, useState } from "react";
import type { KeyCombo } from "../types";
import { normalizeKeyComboFromEvent, formatKeyComboForDisplay } from "../utils/keybinds";

type ShortcutCaptureProps = {
  label: string;
  value?: KeyCombo[] | null;
  onAdd: (combo: KeyCombo) => void;
  onClear: () => void;
};

export const ShortcutCapture = ({ label, value, onAdd, onClear }: ShortcutCaptureProps) => {
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    if (!isCapturing) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // ESC clears existing keybinds.
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClear();
        setIsCapturing(false);
        return;
      }

      const combo = normalizeKeyComboFromEvent(event);
      if (!combo) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onAdd(combo);
      setIsCapturing(false);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isCapturing, onAdd, onClear]);

  const hasValue = Array.isArray(value) && value.length > 0;

  if (!isCapturing) {
    return (
      <button
        type="button"
        className="secondary-button settings-row-action"
        onClick={() => setIsCapturing(true)}
        title={hasValue ? "Change shortcut" : "Add shortcut"}
      >
        {hasValue
          ? value!.map((combo) => formatKeyComboForDisplay(combo)).join(", ")
          : label}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="primary-button settings-row-action"
      title="Press a key combination, or ESC to clear"
    >
      Press keys… (ESC to clear)
    </button>
  );
};

