import { create } from "zustand";
import { fetchArtistInfo, type ArtistInfo } from "../utils/artistApi";
import { getArtistDataPersistent } from "../utils/preferences";
import { artistCacheDb } from "../db/db";

const MB_RATE_MS = 1200;

function normalizeKey(name: string): string {
  return name.trim().toLowerCase();
}

type ArtistState = {
  cache: Record<string, ArtistInfo | null>;
  loading: Set<string>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  getCached: (name: string) => ArtistInfo | null | undefined;
  fetchArtist: (name: string) => Promise<ArtistInfo | null>;
  prefetchArtists: (names: string[]) => Promise<void>;
  clearCache: () => Promise<void>;
  removeArtist: (name: string) => Promise<void>;
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

let requestQueue = Promise.resolve();

export const useArtistStore = create<ArtistState>((set, get) => ({
  cache: {},
  loading: new Set(),
  hydrated: false,

  async hydrate() {
    if (get().hydrated) return;
    if (!getArtistDataPersistent()) {
      set({ hydrated: true });
      return;
    }
    try {
      const persisted = await artistCacheDb.getAll();
      set((s) => ({ cache: { ...s.cache, ...persisted }, hydrated: true }));
    } catch {
      set({ hydrated: true });
    }
  },

  getCached(name: string) {
    const key = normalizeKey(name);
    if (!key) return undefined;
    return get().cache[key];
  },

  async fetchArtist(name: string): Promise<ArtistInfo | null> {
    const key = normalizeKey(name);
    if (!key || key === "unknown artist") return null;
    const { cache, loading } = get();
    if (cache[key] !== undefined) return cache[key];
    if (loading.has(key)) {
      await delay(300);
      return get().fetchArtist(name);
    }
    set((s) => ({ loading: new Set(s.loading).add(key) }));
    const prev = requestQueue;
    let resolve: () => void = () => {};
    requestQueue = new Promise<void>((r) => {
      resolve = r;
    });
    await prev;
    await delay(MB_RATE_MS);
    try {
      const info = await fetchArtistInfo(name);
      const toStore = info ?? null;
      set((s) => ({
        cache: { ...s.cache, [key]: toStore },
        loading: (() => {
          const next = new Set(s.loading);
          next.delete(key);
          return next;
        })(),
      }));
      if (getArtistDataPersistent()) {
        await artistCacheDb.put(key, toStore);
      }
      return info;
    } catch {
      const toStore = null;
      set((s) => ({
        cache: { ...s.cache, [key]: toStore },
        loading: (() => {
          const next = new Set(s.loading);
          next.delete(key);
          return next;
        })(),
      }));
      if (getArtistDataPersistent()) {
        await artistCacheDb.put(key, toStore);
      }
      return null;
    } finally {
      resolve();
    }
  },

  async prefetchArtists(names: string[]) {
    const seen = new Set<string>();
    for (const name of names) {
      const key = normalizeKey(name);
      if (!key || key === "unknown artist" || seen.has(key)) continue;
      seen.add(key);
      if (get().cache[key] !== undefined) continue;
      await get().fetchArtist(name);
    }
  },

  async clearCache() {
    set({ cache: {} });
    if (getArtistDataPersistent()) {
      await artistCacheDb.clear();
    }
  },

  async removeArtist(name: string) {
    const key = normalizeKey(name);
    if (!key) return;
    set((s) => {
      const next = { ...s.cache };
      delete next[key];
      return { cache: next };
    });
    if (getArtistDataPersistent()) {
      await artistCacheDb.remove(key);
    }
  },
}));
