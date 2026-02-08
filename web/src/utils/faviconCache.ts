/**
 * Preload and permanently cache favicons for known link domains (Spotify, Deezer,
 * TikTok, etc.) so they are stored in memory and not re-fetched on every use.
 */

const FAVICON_BASE = "https://www.google.com/s2/favicons?domain=";
const FAVICON_SIZE = 48;

/** Domains we show as link tiles; favicons for these are preloaded at app start. */
export const FAVICON_PRELOAD_DOMAINS = [
  "youtube.com",
  "youtu.be",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "spotify.com",
  "open.spotify.com",
  "instagram.com",
  "facebook.com",
  "fb.com",
  "fb.me",
  "music.apple.com",
  "apple.com",
  "deezer.com",
  "soundcloud.com",
  "bandcamp.com",
  "twitch.tv",
  "vimeo.com",
] as const;

/** In-memory cache: domain (lowercase) -> data URL. Never cleared. */
const cache = new Map<string, string>();

let preloadStarted = false;

function remoteUrl(domain: string): string {
  return `${FAVICON_BASE}${encodeURIComponent(domain)}&sz=${FAVICON_SIZE}`;
}

async function fetchAndCache(domain: string): Promise<void> {
  const url = remoteUrl(domain);
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    cache.set(domain.toLowerCase(), dataUrl);
  } catch {
    // Leave uncached; getFaviconUrl will return remote URL as fallback
  }
}

/**
 * Preload favicons for all known link domains. Safe to call multiple times;
 * runs only once. Call at app startup so icons are in memory before first use.
 */
export function startFaviconPreload(): void {
  if (preloadStarted) return;
  preloadStarted = true;
  Promise.all(FAVICON_PRELOAD_DOMAINS.map((d) => fetchAndCache(d))).catch(() => {});
}

/**
 * Returns the favicon URL for a given domain or full URL.
 * If the favicon was preloaded, returns the in-memory data URL; otherwise
 * returns the remote Google favicon URL (so the img still loads).
 */
export function getFaviconUrl(domainOrUrl: string): string {
  let domain: string;
  try {
    if (domainOrUrl.startsWith("http://") || domainOrUrl.startsWith("https://")) {
      domain = new URL(domainOrUrl).hostname.replace(/^www\./, "").toLowerCase();
    } else {
      domain = domainOrUrl.replace(/^www\./, "").toLowerCase();
    }
  } catch {
    return "";
  }
  const cached = cache.get(domain);
  if (cached) return cached;
  return remoteUrl(domain);
}
