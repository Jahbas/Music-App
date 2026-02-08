/**
 * Artist metadata: MusicBrainz (name, type, country, links – no images).
 * Artist profile pictures: iTunes Search and Deezer API (no keys required).
 */

const MUSICBRAINZ_BASE = "https://musicbrainz.org/ws/2";
const ITUNES_SEARCH = "https://itunes.apple.com/search";
const DEEZER_API = "https://api.deezer.com";
const USER_AGENT = "Music-electron/1.0 (https://github.com)";

export type ArtistInfo = {
  name: string;
  mbid?: string;
  type?: string;
  country?: string;
  disambiguation?: string;
  imageUrl?: string;
  musicBrainzUrl?: string;
  itunesUrl?: string;
  deezerUrl?: string;
};

type MusicBrainzArtist = {
  id: string;
  name: string;
  "sort-name"?: string;
  type?: string;
  country?: string;
  disambiguation?: string;
  "life-span"?: { begin?: string; end?: string; ended?: boolean };
  area?: { name: string };
  tags?: { name: string; count: number }[];
};

type MusicBrainzSearchResponse = {
  artists?: MusicBrainzArtist[];
  count?: number;
  offset?: number;
};

type iTunesArtistResult = {
  artistName: string;
  artistId: number;
  artistLinkUrl?: string;
  artworkUrl100?: string;
  artworkUrl60?: string;
};

type iTunesSearchResponse = {
  resultCount: number;
  results?: iTunesArtistResult[];
};

type DeezerArtist = {
  id: number;
  name: string;
  picture?: string;
  picture_small?: string;
  picture_medium?: string;
  picture_big?: string;
  picture_xl?: string;
  link?: string;
};

type DeezerSearchResponse = {
  data?: DeezerArtist[];
  total?: number;
};

/** Search MusicBrainz for artists by name. Respect rate limit (1 req/sec) externally. */
export async function searchMusicBrainzArtist(artistName: string): Promise<ArtistInfo | null> {
  const query = `artist:${artistName.trim()}`;
  const url = `${MUSICBRAINZ_BASE}/artist/?query=${encodeURIComponent(query)}&limit=5&fmt=json`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as MusicBrainzSearchResponse;
    const artists = data.artists;
    if (!artists?.length) return null;
    const best = artists[0];
    return {
      name: best.name,
      mbid: best.id,
      type: best.type ?? undefined,
      country: best.country ?? best.area?.name ?? undefined,
      disambiguation: best.disambiguation ?? undefined,
      musicBrainzUrl: `https://musicbrainz.org/artist/${best.id}`,
    };
  } catch {
    return null;
  }
}

/** Fetch artist profile picture and link from iTunes Search (no key). MusicBrainz has no artist images. */
export async function fetchItunesArtistArtwork(artistName: string): Promise<{ imageUrl?: string; itunesUrl?: string }> {
  const term = artistName.trim();
  if (!term) return {};
  const url = `${ITUNES_SEARCH}?term=${encodeURIComponent(term)}&entity=musicArtist&limit=3`;
  try {
    const res = await fetch(url);
    if (!res.ok) return {};
    const data = (await res.json()) as iTunesSearchResponse;
    const results = data.results;
    if (!results?.length) return {};
    const first = results[0];
    const imageUrl = first.artworkUrl100 ?? first.artworkUrl60 ?? undefined;
    const itunesUrl = first.artistLinkUrl ?? undefined;
    return { imageUrl, itunesUrl };
  } catch {
    return {};
  }
}

/** Deezer CDN URLs with a real hash load reliably; /artist// is a placeholder. */
function isDeezerCdnImage(imageUrl: string | undefined): boolean {
  return (
    typeof imageUrl === "string" &&
    imageUrl.includes("cdn-images.dzcdn.net") &&
    !imageUrl.includes("/artist//")
  );
}

/** Prefer CDN image URL (reliable in img tags); skip API redirect and placeholder. */
function pickDeezerImageUrl(artist: DeezerArtist): string | undefined {
  const candidates = [
    artist.picture_big,
    artist.picture_medium,
    artist.picture_xl,
    artist.picture_small,
  ].filter((u): u is string => typeof u === "string" && u.length > 0);
  return candidates.find(isDeezerCdnImage);
}

/** Deezer request URL: use proxy in dev (localhost) to avoid CORS; use IPC or direct in other contexts. */
function getDeezerRequestUrl(path: string): { url: string; useProxy: boolean } {
  const origin = typeof window !== "undefined" ? window.location?.origin ?? "" : "";
  const isLocalhost = /^https?:\/\/localhost(:\d+)?$/.test(origin);
  if (isLocalhost) {
    return { url: `/api/deezer${path}`, useProxy: true };
  }
  return { url: `${DEEZER_API}${path}`, useProxy: false };
}

/** Fetch artist picture and link from Deezer API (no key). Use as fallback when iTunes has no image. */
export async function fetchDeezerArtistArtwork(artistName: string): Promise<{ imageUrl?: string; deezerUrl?: string }> {
  const term = artistName.trim();
  if (!term) return {};
  const path = `/search/artist?q=${encodeURIComponent(term)}&limit=5`;
  const { url: requestUrl, useProxy } = getDeezerRequestUrl(path);
  try {
    const electronAPI = typeof window !== "undefined" ? window.electronAPI : undefined;
    let data: DeezerSearchResponse;

    if (!useProxy && electronAPI?.fetchDeezerUrl) {
      const fullUrl = `${DEEZER_API}${path}`;
      const res = await electronAPI.fetchDeezerUrl(fullUrl);
      if (!res.ok || res.body === null) return {};
      try {
        data = JSON.parse(res.body) as DeezerSearchResponse;
      } catch {
        return {};
      }
    } else {
      const res = await fetch(requestUrl);
      if (!res.ok) return {};
      data = (await res.json()) as DeezerSearchResponse;
    }

    const artists = data.data;
    if (!artists?.length) return {};

    const best = artists.find((a) => pickDeezerImageUrl(a)) ?? artists[0];
    const imageUrl = pickDeezerImageUrl(best);
    const deezerUrl = best.link ?? (best.id ? `https://www.deezer.com/artist/${best.id}` : undefined);
    return { imageUrl, deezerUrl };
  } catch {
    return {};
  }
}

/** Relation from MusicBrainz artist lookup (url-rels). */
export type ArtistUrlRelation = {
  type: string;
  typeId?: string;
  url: string;
};

type MusicBrainzUrlRelation = {
  type?: string;
  "type-id"?: string;
  url?: { id?: string; resource?: string };
};

type MusicBrainzArtistLookupResponse = {
  id?: string;
  name?: string;
  relations?: MusicBrainzUrlRelation[];
};

/** Fetch all URL relations (socials, official site, streaming, etc.) for an artist by MusicBrainz ID. */
export async function fetchArtistUrlRelations(mbid: string): Promise<ArtistUrlRelation[]> {
  if (!mbid.trim()) return [];
  const url = `${MUSICBRAINZ_BASE}/artist/${encodeURIComponent(mbid)}?inc=url-rels&fmt=json`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as MusicBrainzArtistLookupResponse;
    const relations = data.relations ?? [];
    return relations
      .filter((r): r is MusicBrainzUrlRelation & { url: { resource?: string } } => !!r.url?.resource)
      .map((r) => ({
        type: r.type ?? "other",
        typeId: r["type-id"],
        url: r.url.resource ?? "",
      }));
  } catch {
    return [];
  }
}

/** Combine MusicBrainz (metadata) + iTunes and Deezer (profile pictures). Rate-limit MusicBrainz to 1 req/sec. */
export async function fetchArtistInfo(artistName: string): Promise<ArtistInfo | null> {
  const trimmed = artistName.trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown artist") return null;

  const [mb, itunes, deezer] = await Promise.all([
    searchMusicBrainzArtist(trimmed),
    fetchItunesArtistArtwork(trimmed),
    fetchDeezerArtistArtwork(trimmed),
  ]);

  const imageUrl = itunes.imageUrl ?? deezer.imageUrl;

  if (!mb && !imageUrl) return null;

  return {
    name: mb?.name ?? trimmed,
    mbid: mb?.mbid,
    type: mb?.type,
    country: mb?.country,
    disambiguation: mb?.disambiguation,
    imageUrl: imageUrl ?? undefined,
    musicBrainzUrl: mb?.musicBrainzUrl,
    itunesUrl: itunes.itunesUrl ?? mb?.itunesUrl,
    deezerUrl: deezer.deezerUrl,
  };
}
