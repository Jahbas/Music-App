import { create } from "zustand";
import type { KeybindAction, KeybindMap, KeyCombo, Profile } from "../types";
import { DEFAULT_KEYBINDS } from "../config/defaultKeybinds";
import { useProfileStore } from "./profileStore";
import { profileDb } from "../db/db";

type KeybindState = {
  keybinds: KeybindMap;
  hydrateFromProfiles: () => Promise<void>;
  setKeybind: (action: KeybindAction, combos: KeyCombo[]) => void;
  addKeybind: (action: KeybindAction, combo: KeyCombo) => void;
  clearKeybinds: (action: KeybindAction) => void;
  resetToDefaults: () => void;
  replaceAll: (next: KeybindMap) => void;
};

function cloneKeybinds(map: KeybindMap): KeybindMap {
  const out: KeybindMap = {};
  for (const [action, combos] of Object.entries(map) as [KeybindAction, KeyCombo[]][]) {
    if (!Array.isArray(combos)) continue;
    out[action] = [...combos];
  }
  return out;
}

async function persistKeybindsForProfile(profile: Profile, keybinds: KeybindMap): Promise<void> {
  const next: Profile = {
    ...profile,
    keybinds: cloneKeybinds(keybinds),
  };
  await profileDb.put(next);
}

export const useKeybindStore = create<KeybindState>((set, get) => ({
  keybinds: cloneKeybinds(DEFAULT_KEYBINDS),
  hydrateFromProfiles: async () => {
    const profileState = useProfileStore.getState();
    const { profiles, currentProfileId } = profileState;
    if (!currentProfileId || profiles.length === 0) {
      set({ keybinds: cloneKeybinds(DEFAULT_KEYBINDS) });
      return;
    }
    const profile = profiles.find((p) => p.id === currentProfileId);
    if (!profile || !profile.keybinds) {
      set({ keybinds: cloneKeybinds(DEFAULT_KEYBINDS) });
      return;
    }
    set({ keybinds: cloneKeybinds(profile.keybinds) });
  },
  setKeybind: (action, combos) => {
    const profileState = useProfileStore.getState();
    const { profiles, currentProfileId } = profileState;
    const prev = get().keybinds;
    const next: KeybindMap = {
      ...prev,
      [action]: combos,
    };
    set({ keybinds: next });
    const profile = profiles.find((p) => p.id === currentProfileId);
    if (profile && currentProfileId) {
      void persistKeybindsForProfile(profile, next);
    }
  },
  addKeybind: (action, combo) => {
    const current = get().keybinds[action] ?? [];
    if (current.includes(combo)) {
      return;
    }
    get().setKeybind(action, [...current, combo]);
  },
  clearKeybinds: (action) => {
    get().setKeybind(action, []);
  },
  resetToDefaults: () => {
    const profileState = useProfileStore.getState();
    const { profiles, currentProfileId } = profileState;
    const next = cloneKeybinds(DEFAULT_KEYBINDS);
    set({ keybinds: next });
    const profile = profiles.find((p) => p.id === currentProfileId);
    if (profile && currentProfileId) {
      void persistKeybindsForProfile(profile, next);
    }
  },
  replaceAll: (next) => {
    const profileState = useProfileStore.getState();
    const { profiles, currentProfileId } = profileState;
    const cloned = cloneKeybinds(next);
    set({ keybinds: cloned });
    const profile = profiles.find((p) => p.id === currentProfileId);
    if (profile && currentProfileId) {
      void persistKeybindsForProfile(profile, cloned);
    }
  },
}));

// Keep the keybinds in sync when the active profile changes.
useProfileStore.subscribe(() => {
  void useKeybindStore.getState().hydrateFromProfiles();
});

