import { create } from "zustand";

type LikedToastState = {
  trackId: string | null;
  /** true = added to liked, false = removed from liked */
  added: boolean;
  show: (trackId: string, added: boolean) => void;
  hide: () => void;
};

export const useLikedToastStore = create<LikedToastState>((set) => ({
  trackId: null,
  added: false,
  show: (trackId, added) => set({ trackId, added }),
  hide: () => set({ trackId: null }),
}));
