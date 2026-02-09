import type { KeyCombo } from "../types";

type KeyLikeEvent = {
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  code?: string;
  key?: string;
};

export function normalizeKeyComboFromEvent(event: KeyLikeEvent): KeyCombo | null {
  // Ignore pure modifier presses with no meaningful key.
  const rawKey = event.key ?? "";
  const rawCode = event.code ?? "";

  const isModifierOnly =
    rawKey === "Shift" ||
    rawKey === "Control" ||
    rawKey === "Alt" ||
    rawKey === "Meta";
  if (isModifierOnly) return null;

  let base = "";

  // Prefer well-known codes for non-character keys.
  if (rawCode === "Space") {
    base = "Space";
  } else if (rawCode.startsWith("Arrow")) {
    base = rawCode;
  } else if (rawCode === "Slash") {
    base = "Slash";
  } else if (rawCode.startsWith("Key") && rawCode.length === 4) {
    // KeyA → A
    base = rawCode.slice(3).toUpperCase();
  } else if (rawKey && rawKey.length === 1) {
    // Single character keys (letters, digits, punctuation)
    base = rawKey.toUpperCase();
  } else if (rawKey) {
    base = rawKey;
  } else if (rawCode) {
    base = rawCode;
  }

  if (!base) {
    return null;
  }

  const parts: string[] = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Meta");
  parts.push(base);

  return parts.join("+");
}

export function formatKeyComboForDisplay(combo: KeyCombo): string {
  // Present nicer labels for a few common keys.
  return combo
    .replace(/\bSlash\b/g, "/")
    .replace(/\bSpace\b/g, "Space")
    .replace(/\bArrowUp\b/g, "↑")
    .replace(/\bArrowDown\b/g, "↓")
    .replace(/\bArrowLeft\b/g, "←")
    .replace(/\bArrowRight\b/g, "→");
}

