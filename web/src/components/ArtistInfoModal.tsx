import { useState, useEffect } from "react";
import { Modal } from "./Modal";
import { fetchArtistUrlRelations, type ArtistInfo, type ArtistUrlRelation } from "../utils/artistApi";
import { getFaviconUrl, FAVICON_PRELOAD_DOMAINS } from "../utils/faviconCache";

/** Only show these social/streaming links; hide MusicBrainz, wikidata, random DBs, etc. */
const KNOWN_LINK_DOMAINS = new Set<string>(FAVICON_PRELOAD_DOMAINS);

function getHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function isKnownLink(url: string): boolean {
  const host = getHost(url);
  if (!host) return false;
  return KNOWN_LINK_DOMAINS.has(host) || [...KNOWN_LINK_DOMAINS].some((d) => host.endsWith("." + d) || host === d);
}

function faviconUrl(url: string): string {
  const host = getHost(url);
  if (!host) return "";
  return getFaviconUrl(host);
}

function linkLabel(url: string): string {
  const host = getHost(url);
  return host ?? url;
}

type ArtistInfoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  artistName: string;
  artistInfo: ArtistInfo | null | undefined;
  trackCount?: number;
};

export const ArtistInfoModal = ({
  isOpen,
  onClose,
  artistName,
  artistInfo,
  trackCount = 0,
}: ArtistInfoModalProps) => {
  const [urlRelations, setUrlRelations] = useState<ArtistUrlRelation[]>([]);
  const [loadingUrls, setLoadingUrls] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setUrlRelations([]);
    const mbid = artistInfo?.mbid;
    if (!mbid) {
      setLoadingUrls(false);
      return;
    }
    setLoadingUrls(true);
    let cancelled = false;
    fetchArtistUrlRelations(mbid)
      .then((rels) => {
        if (!cancelled) setUrlRelations(rels);
      })
      .finally(() => {
        if (!cancelled) setLoadingUrls(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, artistInfo?.mbid]);

  const displayName = artistInfo?.name ?? artistName;
  const allLinks: { url: string }[] = [
    ...urlRelations.filter((r) => isKnownLink(r.url)).map((r) => ({ url: r.url })),
    ...(artistInfo?.itunesUrl && isKnownLink(artistInfo.itunesUrl) ? [{ url: artistInfo.itunesUrl }] : []),
    ...(artistInfo?.deezerUrl && isKnownLink(artistInfo.deezerUrl) ? [{ url: artistInfo.deezerUrl }] : []),
  ];
  const uniqueUrls = Array.from(new Map(allLinks.map((l) => [l.url, l])).values());

  const LinkTile = ({ url }: { url: string }) => {
    const src = faviconUrl(url);
    const title = linkLabel(url);
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="artist-info-link-tile"
        title={title}
        aria-label={title}
      >
        {src ? <img src={src} alt="" width={32} height={32} /> : <span className="artist-info-link-dot" />}
      </a>
    );
  };

  return (
    <Modal title="" isOpen={isOpen} onClose={onClose} className="artist-info-modal">
      <div className="artist-info-modal-content">
        <div className="artist-info-modal-header">
          <div className="artist-info-modal-artwork">
            {artistInfo?.imageUrl ? (
              <img src={artistInfo.imageUrl} alt="" />
            ) : (
              <div className="artist-info-modal-placeholder" aria-hidden>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2a4 4 0 0 0-4 4v2a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z" />
                  <path d="M4 10a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2" />
                </svg>
              </div>
            )}
          </div>
          <div className="artist-info-modal-meta">
            <h4 className="artist-info-modal-name">{displayName}</h4>
            {(artistInfo?.type || artistInfo?.country) && (
              <span className="artist-info-modal-sub muted">
                {[artistInfo?.type, artistInfo?.country].filter(Boolean).join(" · ")}
              </span>
            )}
            {trackCount > 0 && (
              <span className="artist-info-modal-sub muted">{trackCount} tracks</span>
            )}
          </div>
        </div>

        <div className="artist-info-modal-links">
          {!artistInfo?.mbid && (
            <p className="artist-info-modal-hint muted">Load from MusicBrainz to see links.</p>
          )}
          {artistInfo?.mbid && loadingUrls && (
            <div className="artist-info-link-grid artist-info-link-grid--loading" aria-hidden>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="artist-info-link-tile artist-info-link-tile--skeleton" />
              ))}
            </div>
          )}
          {artistInfo?.mbid && !loadingUrls && uniqueUrls.length > 0 && (
            <div className="artist-info-link-grid">
              {uniqueUrls.map(({ url }, i) => (
                <LinkTile key={`${url}-${i}`} url={url} />
              ))}
            </div>
          )}
          {artistInfo?.mbid && !loadingUrls && uniqueUrls.length === 0 && (
            <p className="artist-info-modal-hint muted">No links found.</p>
          )}
        </div>
      </div>
    </Modal>
  );
};
