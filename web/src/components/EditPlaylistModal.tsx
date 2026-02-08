import { useState, useEffect, useRef } from "react";
import { usePlaylistStore } from "../stores/playlistStore";
import { useFolderStore } from "../stores/folderStore";
import { Modal } from "./Modal";
import { FolderSelect } from "./FolderSelect";
import type { Playlist } from "../types";

const NAME_MAX_LENGTH = 32;

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type EditPlaylistModalProps = {
  isOpen: boolean;
  onClose: () => void;
  playlist: Playlist | null;
  onDeleted?: () => void;
};

export const EditPlaylistModal = ({
  isOpen,
  onClose,
  playlist,
  onDeleted,
}: EditPlaylistModalProps) => {
  const updatePlaylist = usePlaylistStore((state) => state.updatePlaylist);
  const updatePlaylistImage = usePlaylistStore(
    (state) => state.updatePlaylistImage
  );
  const updatePlaylistBanner = usePlaylistStore(
    (state) => state.updatePlaylistBanner
  );
  const deletePlaylist = usePlaylistStore((state) => state.deletePlaylist);
  const folders = useFolderStore((state) => state.folders);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pinned, setPinned] = useState(false);
  const [folderId, setFolderId] = useState<string>("");
  const [coverFile, setCoverFile] = useState<File | undefined>(undefined);
  const [bannerFile, setBannerFile] = useState<File | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [infoExpanded, setInfoExpanded] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [watchEnabled, setWatchEnabled] = useState(false);
  const [watchPath, setWatchPath] = useState("");
  const [watchInfoHover, setWatchInfoHover] = useState(false);

  useEffect(() => {
    if (playlist) {
      setName(playlist.name);
      setDescription(playlist.description ?? "");
      setPinned(playlist.pinned ?? false);
      setFolderId(playlist.folderId ?? "");
      setWatchEnabled(playlist.watchEnabled ?? false);
      setWatchPath(playlist.watchPath ?? "");
      setCoverFile(undefined);
      setBannerFile(undefined);
      setConfirmDelete(false);
    }
  }, [playlist, isOpen]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!playlist || !trimmed || trimmed.length > NAME_MAX_LENGTH) {
      return;
    }
    const pathTrimmed = watchPath.trim();
    const shouldWatch = watchEnabled && Boolean(pathTrimmed);
    await updatePlaylist(playlist.id, {
      name: trimmed,
      description: description.trim() || undefined,
      pinned,
      folderId: folderId || null,
      watchEnabled: shouldWatch,
      watchPath: pathTrimmed || undefined,
    });

    const api = window.electronAPI;
    if (api?.watchStart && api?.watchStop) {
      if (shouldWatch && pathTrimmed) {
        api.watchStart({ folderId: playlist.id, path: pathTrimmed, playlistId: playlist.id });
      } else {
        api.watchStop(playlist.id);
      }
    }
    if (coverFile) {
      await updatePlaylistImage(playlist.id, coverFile);
    }
    if (bannerFile) {
      await updatePlaylistBanner(playlist.id, bannerFile);
    }
    onClose();
  };

  const handleRemoveCover = async () => {
    if (!playlist) return;
    await updatePlaylistImage(playlist.id, null);
    setCoverFile(undefined);
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  const handleRemoveBanner = async () => {
    if (!playlist) return;
    await updatePlaylistBanner(playlist.id, null);
    setBannerFile(undefined);
    if (bannerInputRef.current) bannerInputRef.current.value = "";
  };

  const handleDelete = async () => {
    if (!playlist) {
      return;
    }
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deletePlaylist(playlist.id);
    setConfirmDelete(false);
    onClose();
    onDeleted?.();
  };

  if (!playlist) {
    return null;
  }

  const hasCover = playlist.imageId || coverFile;
  const hasBanner = playlist.bannerImageId || bannerFile;

  return (
    <Modal
      title="Playlist settings"
      isOpen={isOpen}
      onClose={onClose}
      className="settings-modal"
    >
      <form className="form" onSubmit={handleSubmit}>
        <div className="settings-sections">
          <section className="settings-section">
            <h4 className="settings-section-title">Basic</h4>
            <label>
              Playlist name
              <input
                value={name}
                onChange={(event) =>
                  setName(event.target.value.slice(0, NAME_MAX_LENGTH))
                }
                placeholder="My Playlist"
                maxLength={NAME_MAX_LENGTH}
              />
            </label>
            <label>
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </label>
          </section>

          <section className="settings-section">
            <h4 className="settings-section-title">Appearance</h4>
            <div className="settings-row" style={{ gap: 12, alignItems: "flex-start" }}>
              <div className="form-image-upload" style={{ flex: 1 }}>
                <span className="form-image-upload-label">Cover image</span>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="form-image-upload-input"
                  aria-label="Choose cover image"
                  onChange={(event) =>
                    setCoverFile(event.target.files?.[0] ?? undefined)
                  }
                />
                <div className="form-image-upload-row">
                  <button
                    type="button"
                    className="upload-button form-image-upload-button"
                    onClick={() => coverInputRef.current?.click()}
                  >
                    {coverFile
                      ? coverFile.name
                      : playlist.imageId
                        ? "Change image"
                        : "Choose image"}
                  </button>
                  {hasCover && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={handleRemoveCover}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <div className="form-image-upload" style={{ flex: 1 }}>
                <span className="form-image-upload-label">Banner image</span>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  className="form-image-upload-input"
                  aria-label="Choose banner image"
                  onChange={(event) =>
                    setBannerFile(event.target.files?.[0] ?? undefined)
                  }
                />
                <div className="form-image-upload-row">
                  <button
                    type="button"
                    className="upload-button form-image-upload-button"
                    onClick={() => bannerInputRef.current?.click()}
                  >
                    {bannerFile
                      ? bannerFile.name
                      : playlist.bannerImageId
                        ? "Change banner"
                        : "Choose image"}
                  </button>
                  {hasBanner && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={handleRemoveBanner}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="settings-section settings-section-collapsible">
            <button
              type="button"
              className="settings-collapse-trigger"
              onClick={() => setInfoExpanded(!infoExpanded)}
              aria-expanded={infoExpanded}
            >
              <h4 className="settings-section-title">Organization</h4>
              <span className="settings-collapse-icon" aria-hidden>
                {infoExpanded ? "−" : "+"}
              </span>
            </button>
            {infoExpanded && folders.length > 0 && (
              <div className="settings-collapse-content">
                <label>
                  Folder
                  <FolderSelect value={folderId} onChange={setFolderId} />
                </label>
              </div>
            )}
          </section>

          <section className="settings-section">
            <h4 className="settings-section-title">Sidebar</h4>
            <div className="settings-row">
              <span className="settings-row-label">Pin to top</span>
              <button
                type="button"
                role="checkbox"
                aria-checked={pinned}
                className={`custom-checkbox ${pinned ? "custom-checkbox--checked" : ""}`}
                onClick={() => setPinned(!pinned)}
                aria-label="Pin to top"
              >
                <span className="custom-checkbox-box" aria-hidden>
                  {pinned ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : null}
                </span>
              </button>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-title-row">
              <h4 className="settings-section-title">Watchlist</h4>
              <span
                className="settings-info-icon"
                onMouseEnter={() => setWatchInfoHover(true)}
                onMouseLeave={() => setWatchInfoHover(false)}
                aria-label="Watchlist info"
              >
                i
                {watchInfoHover && (
                  <div className="settings-info-tooltip" role="tooltip">
                    <p className="settings-info-body">
                      When enabled, new audio files added to the watched folder are automatically imported and added to this playlist.
                    </p>
                  </div>
                )}
              </span>
            </div>
            <label>
              Folder path
              <div className="settings-row" style={{ gap: 10 }}>
                <input
                  value={watchPath}
                  onChange={(e) => setWatchPath(e.target.value)}
                  placeholder="C:\\Music\\New"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="secondary-button"
                  onClick={async () => {
                    const api = window.electronAPI?.pickDirectory;
                    if (!api) return;
                    const picked = await api(watchPath || undefined);
                    if (picked) setWatchPath(picked);
                  }}
                  title="Choose folder to watch"
                >
                  Browse
                </button>
              </div>
            </label>
            <div className="settings-row">
              <span className="settings-row-label">Enable watchlist</span>
              <button
                type="button"
                role="checkbox"
                aria-checked={watchEnabled}
                className={`custom-checkbox ${watchEnabled ? "custom-checkbox--checked" : ""}`}
                onClick={() => setWatchEnabled(!watchEnabled)}
                aria-label="Enable watchlist"
              >
                <span className="custom-checkbox-box" aria-hidden>
                  {watchEnabled ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : null}
                </span>
              </button>
            </div>
          </section>

          <section className="settings-section settings-section-collapsible">
            <button
              type="button"
              className="settings-collapse-trigger"
              onClick={() => setInfoExpanded(!infoExpanded)}
              aria-expanded={infoExpanded}
            >
              <h4 className="settings-section-title">Info</h4>
              <span className="settings-collapse-icon" aria-hidden>
                {infoExpanded ? "−" : "+"}
              </span>
            </button>
            {infoExpanded && (
              <div className="settings-collapse-content">
                <div className="settings-row settings-row-readonly">
                  <span className="settings-row-label">Created</span>
                  <span className="settings-row-value">
                    {formatDate(playlist.createdAt)}
                  </span>
                </div>
                <div className="settings-row settings-row-readonly">
                  <span className="settings-row-label">Updated</span>
                  <span className="settings-row-value">
                    {formatDate(playlist.updatedAt)}
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="form-actions form-actions-with-danger">
          <button className="primary-button" type="submit">
            Save
          </button>
          <button
            className={confirmDelete ? "danger-button" : "secondary-button"}
            type="button"
            onClick={handleDelete}
          >
            {confirmDelete
              ? "Click again to delete playlist"
              : "Delete playlist"}
          </button>
        </div>
      </form>
    </Modal>
  );
};
