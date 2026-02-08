import { useMemo, useState } from "react";
import { useLibraryStore } from "../stores/libraryStore";
import { useArtistStore } from "../stores/artistStore";
import { usePlayerStore } from "../stores/playerStore";
import { ArtistInfoModal } from "../components/ArtistInfoModal";
import { parseArtistNames } from "../utils/artistNames";

export const ArtistsView = () => {
  const tracks = useLibraryStore((state) => state.tracks);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const setQueue = usePlayerStore((state) => state.setQueue);

  const artistNames = useMemo(() => {
    const set = new Set<string>();
    for (const t of tracks) {
      for (const name of parseArtistNames(t.artist ?? "")) {
        set.add(name);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [tracks]);

  const getCached = useArtistStore((s) => s.getCached);
  const fetchArtist = useArtistStore((s) => s.fetchArtist);
  const removeArtist = useArtistStore((s) => s.removeArtist);
  const loading = useArtistStore((s) => s.loading);

  const loadAll = async () => {
    for (const name of artistNames) {
      if (getCached(name) !== undefined) continue;
      await fetchArtist(name);
    }
  };

  const handleLoadOne = (name: string) => {
    void fetchArtist(name);
  };

  const [infoArtist, setInfoArtist] = useState<string | null>(null);

  const openArtistInfo = (name: string) => {
    setInfoArtist(name);
    if (getCached(name) === undefined) void fetchArtist(name);
  };

  const tracksForArtist = useMemo(() => {
    const map = new Map<string, typeof tracks>();
    for (const name of artistNames) {
      map.set(
        name,
        tracks.filter((t) => parseArtistNames(t.artist ?? "").includes(name))
      );
    }
    return map;
  }, [tracks, artistNames]);

  const handlePlayArtist = (name: string) => {
    const artistTracks = tracksForArtist.get(name) ?? [];
    const queue = artistTracks.map((t) => t.id);
    if (queue.length === 0) return;
    setQueue(queue);
    playTrack(queue[0], queue);
  };

  if (artistNames.length === 0) {
    return (
      <div className="artists-view">
        <h1 className="artists-view-title">Artists</h1>
        <div className="empty-state">
          No artists in your library yet. Add some music to see artists from your tracks, then
          enrich them with data from MusicBrainz, iTunes, and Deezer.
        </div>
      </div>
    );
  }

  return (
    <div className="artists-view">
      <div className="artists-view-header">
        <h1 className="artists-view-title">Artists</h1>
        <p className="artists-view-subtitle muted">
          Artists from your library. Data from{" "}
          <a href="https://musicbrainz.org" target="_blank" rel="noopener noreferrer">
            MusicBrainz
          </a>
          , iTunes, and{" "}
          <a href="https://developers.deezer.com" target="_blank" rel="noopener noreferrer">
            Deezer
          </a>{" "}
          when loaded.
        </p>
        <button
          type="button"
          className="secondary-button"
          onClick={loadAll}
          disabled={loading.size > 0}
        >
          {loading.size > 0 ? "Loading…" : "Load info for all artists"}
        </button>
      </div>
      <ul className="artists-grid">
        {artistNames.map((name) => {
          const cached = getCached(name);
          const isLoading = loading.has(name);
          const trackCount = (tracksForArtist.get(name) ?? []).length;
          return (
            <li key={name} className="artists-card">
              <div className="artists-card-artwork">
                {cached?.imageUrl ? (
                  <img src={cached.imageUrl} alt="" />
                ) : (
                  <div className="artists-card-placeholder" aria-hidden>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 2a4 4 0 0 0-4 4v2a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z" />
                      <path d="M4 10a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="artists-card-body">
                <div className="artists-card-name-row">
                  <button
                    type="button"
                    className="artists-card-name"
                    onClick={() => handlePlayArtist(name)}
                  >
                    {cached?.name ?? name}
                  </button>
                  <button
                    type="button"
                    className="artists-card-info-btn"
                    onClick={() => openArtistInfo(name)}
                    title="Artist info & links"
                    aria-label={`Info for ${cached?.name ?? name}`}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4M12 8h.01" />
                    </svg>
                  </button>
                </div>
                {cached?.disambiguation && (
                  <span className="artists-card-disambiguation muted">{cached.disambiguation}</span>
                )}
                <div className="artists-card-meta muted">
                  {cached?.type && <span>{cached.type}</span>}
                  {cached?.country && <span>{cached.country}</span>}
                  <span>{trackCount} track{trackCount !== 1 ? "s" : ""}</span>
                </div>
                {!cached && !isLoading && (
                  <button
                    type="button"
                    className="artists-card-load"
                    onClick={() => handleLoadOne(name)}
                  >
                    Load from MusicBrainz
                  </button>
                )}
                {isLoading && <span className="artists-card-loading muted">Loading…</span>}
                {cached && (cached.musicBrainzUrl || cached.itunesUrl || cached.deezerUrl) && (
                  <div className="artists-card-links" role="group" aria-label="Open artist on">
                    {cached.musicBrainzUrl && (
                      <a
                        href={cached.musicBrainzUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="artists-card-link-icon"
                        title="MusicBrainz"
                        aria-label="Open on MusicBrainz"
                      >
                        <MusicBrainzIcon />
                      </a>
                    )}
                    {cached.itunesUrl && (
                      <a
                        href={cached.itunesUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="artists-card-link-icon"
                        title="iTunes / Apple Music"
                        aria-label="Open on iTunes / Apple Music"
                      >
                        <AppleMusicIcon />
                      </a>
                    )}
                    {cached.deezerUrl && (
                      <a
                        href={cached.deezerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="artists-card-link-icon"
                        title="Deezer"
                        aria-label="Open on Deezer"
                      >
                        <DeezerIcon />
                      </a>
                    )}
                  </div>
                )}
                {cached && (
                  <button
                    type="button"
                    className="artists-card-remove"
                    onClick={() => void removeArtist(name)}
                    title="Remove cached data for this artist"
                  >
                    Remove from cache
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <ArtistInfoModal
        isOpen={infoArtist !== null}
        onClose={() => setInfoArtist(null)}
        artistName={infoArtist ?? ""}
        artistInfo={infoArtist ? getCached(infoArtist) : undefined}
        trackCount={infoArtist ? (tracksForArtist.get(infoArtist) ?? []).length : 0}
      />
    </div>
  );
};

function MusicBrainzIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2c-2 0-4 1.5-4 4v2c0 2.5 2 4 4 4s4-1.5 4-4V6c0-2.5-2-4-4-4z" />
      <path d="M6 10v8c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2v-8" />
      <path d="M8 14h2M14 14h2M11 11v4" />
    </svg>
  );
}

function AppleMusicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function DeezerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.81 4.16v3.03h2.19V4.16h-2.19zm-4.38 5.42v9.42h2.19V9.58h-2.19zm-4.38 2.78v6.64h2.19v-6.64h-2.19zm-4.38 2.78v3.86h2.19v-3.86H5.67zm-4.38 0v3.86H3.5v-3.86H1.29zm17.52-5.42v9.42h2.19V9.58h-2.19zm-4.38-2.78v12.2h2.19V6.8h-2.19zm-4.38-2.78v14.98h2.19V4.02h-2.19z" />
    </svg>
  );
}
