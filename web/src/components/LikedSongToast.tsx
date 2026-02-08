import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLibraryStore } from "../stores/libraryStore";
import { useLikedToastStore } from "../stores/likedToastStore";
import { usePlaylistStore } from "../stores/playlistStore";
import { useProfileLikesStore } from "../stores/profileLikesStore";

const TOAST_DURATION_MS = 4000;

export const LikedSongToast = () => {
  const { trackId, added, hide } = useLikedToastStore();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tracks = useLibraryStore((state) => state.tracks);
  const toggleTrackLiked = useLibraryStore((state) => state.toggleTrackLiked);
  const playlists = usePlaylistStore((state) => state.playlists);
  const addTracksToPlaylist = usePlaylistStore(
    (state) => state.addTracksToPlaylist
  );
  const removeTrackFromPlaylist = usePlaylistStore(
    (state) => state.removeTrackFromPlaylist
  );
  const likedTrackIds = useProfileLikesStore((state) => state.likedTrackIds);

  const track = useMemo(
    () => (trackId ? tracks.find((t) => t.id === trackId) : null),
    [trackId, tracks]
  );

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!trackId) return;
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      hide();
    }, TOAST_DURATION_MS);
    return clearTimer;
  }, [trackId, added, hide, clearTimer]);

  const handleAdvanced = useCallback(() => {
    setAdvancedOpen(true);
    clearTimer();
  }, [clearTimer]);

  const handleCloseAdvanced = useCallback(() => {
    setAdvancedOpen(false);
    hide();
  }, [hide]);

  if (!trackId) return null;

  return (
    <>
      <div
        key={`toast-${trackId}-${added}`}
        className="liked-toast"
        role="status"
        aria-live="polite"
        aria-label={added ? "Added to Liked Songs" : "Removed from Liked Songs"}
      >
        <span className="liked-toast-message">
          {added ? "Added to Liked Songs" : "Removed from Liked Songs"}
        </span>
        {added && (
          <button
            type="button"
            className="liked-toast-advanced"
            onClick={handleAdvanced}
          >
            Advanced
            <span className="liked-toast-advanced-chevron" aria-hidden>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </span>
          </button>
        )}
      </div>
      {advancedOpen && trackId && (
        <AddToPlaylistsModal
          trackId={trackId}
          trackTitle={track?.title ?? "Track"}
          onClose={handleCloseAdvanced}
          onRemoveFromLiked={() => {
            void toggleTrackLiked(trackId);
            handleCloseAdvanced();
          }}
          isLiked={likedTrackIds.includes(trackId)}
          playlists={playlists}
          addTracksToPlaylist={addTracksToPlaylist}
          removeTrackFromPlaylist={removeTrackFromPlaylist}
        />
      )}
    </>
  );
};

type AddToPlaylistsModalProps = {
  trackId: string;
  trackTitle: string;
  onClose: () => void;
  onRemoveFromLiked: () => void;
  isLiked: boolean;
  playlists: { id: string; name: string; trackIds: string[] }[];
  addTracksToPlaylist: (playlistId: string, trackIds: string[]) => Promise<void>;
  removeTrackFromPlaylist: (
    playlistId: string,
    trackId: string
  ) => Promise<void>;
};

function AddToPlaylistsModal({
  trackId,
  trackTitle,
  onClose,
  onRemoveFromLiked,
  isLiked,
  playlists,
  addTracksToPlaylist,
  removeTrackFromPlaylist,
}: AddToPlaylistsModalProps) {
  const [selected, setSelected] = useState<Set<string>>(() => {
    const set = new Set<string>();
    for (const p of playlists) {
      if (p.trackIds.includes(trackId)) set.add(p.id);
    }
    return set;
  });
  const [saving, setSaving] = useState(false);

  const handleToggle = (playlistId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(playlistId)) next.delete(playlistId);
      else next.add(playlistId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const playlist of playlists) {
        const want = selected.has(playlist.id);
        const has = playlist.trackIds.includes(trackId);
        if (want && !has) {
          await addTracksToPlaylist(playlist.id, [trackId]);
        } else if (!want && has) {
          await removeTrackFromPlaylist(playlist.id, trackId);
        }
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFromLiked = () => {
    onRemoveFromLiked();
  };

  return (
    <div
      className="modal-backdrop modal-backdrop--above-toast"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Add to playlists"
    >
      <div className="modal liked-advanced-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add to playlists</h2>
          <button
            type="button"
            className="ghost-button modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <p className="liked-advanced-track-title" title={trackTitle}>
          {trackTitle}
        </p>
        <div className="liked-advanced-list">
          {playlists.length === 0 ? (
            <p className="muted">No playlists yet. Create one from the sidebar.</p>
          ) : (
            playlists.map((playlist) => {
              const checked = selected.has(playlist.id);
              return (
                <label
                  key={playlist.id}
                  className="liked-advanced-row"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggle(playlist.id)}
                    aria-label={`${checked ? "Remove from" : "Add to"} ${playlist.name}`}
                  />
                  <span className="liked-advanced-row-name">{playlist.name}</span>
                </label>
              );
            })
          )}
        </div>
        <div className="liked-advanced-actions">
          <button
            type="button"
            className="primary-button"
            onClick={handleSave}
            disabled={saving || playlists.length === 0}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {isLiked && (
            <button
              type="button"
              className="secondary-button liked-advanced-remove"
              onClick={handleRemoveFromLiked}
            >
              Remove from Liked Songs
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
