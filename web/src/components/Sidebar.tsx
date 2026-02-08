import { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePlaylistStore } from "../stores/playlistStore";
import { useFolderStore } from "../stores/folderStore";
import { useLibraryStore } from "../stores/libraryStore";
import { usePlayerStore } from "../stores/playerStore";
import { useArtistStore } from "../stores/artistStore";
import { CreatePlaylistModal } from "./CreatePlaylistModal";
import { EditPlaylistModal } from "./EditPlaylistModal";
import { CreateFolderModal } from "./CreateFolderModal";
import { EditFolderModal } from "./EditFolderModal";
import { useImageUrl } from "../hooks/useImageUrl";
import type { DragContext } from "../hooks/useDragContext";
import type { Playlist, PlaylistFolder } from "../types";
import {
  getFilesFromDataTransfer,
  getAudioFileHandlesFromDirectory,
  getDirectSubdirectoryHandles,
  buildFolderImportPreview,
  type FolderImportPreviewEntry,
} from "../utils/folderDrop";
import { FolderImportPreviewModal } from "./FolderImportPreviewModal";

function sortPlaylists(playlists: Playlist[]): Playlist[] {
  return [...playlists].sort((a, b) => {
    const aPinned = a.pinned === true ? 1 : 0;
    const bPinned = b.pinned === true ? 1 : 0;
    if (bPinned !== aPinned) return bPinned - aPinned;
    const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0) || a.name.localeCompare(b.name);
  });
}

type SidebarArtistsButtonProps = { onNavigate: (path: string) => void };

function SidebarArtistsButton({ onNavigate }: SidebarArtistsButtonProps) {
  const tracks = useLibraryStore((s) => s.tracks);
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const getCached = useArtistStore((s) => s.getCached);
  const fetchArtist = useArtistStore((s) => s.fetchArtist);

  const currentTrack = useMemo(
    () => tracks.find((t) => t.id === currentTrackId),
    [tracks, currentTrackId]
  );
  const artistName = currentTrack?.artist?.trim();
  const artistInfo = artistName ? getCached(artistName) : null;
  const artistImageUrl = artistInfo?.imageUrl ?? null;

  useEffect(() => {
    if (artistName && artistName.toLowerCase() !== "unknown artist" && getCached(artistName) === undefined) {
      void fetchArtist(artistName);
    }
  }, [artistName, fetchArtist, getCached]);

  return (
    <button
      type="button"
      className="sidebar-artists-button"
      onClick={() => onNavigate("/artists")}
      title="Artists"
      aria-label="Open Artists"
    >
      <div className="sidebar-artists-button-avatar">
        {artistImageUrl ? (
          <img src={artistImageUrl} alt="" />
        ) : (
          <span className="sidebar-artists-button-avatar-placeholder" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a4 4 0 0 0-4 4v2a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z" />
              <path d="M4 10a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2" />
            </svg>
          </span>
        )}
      </div>
      <span className="sidebar-artists-button-label">Artists</span>
    </button>
  );
}

function sortFolders(folders: PlaylistFolder[]): PlaylistFolder[] {
  return [...folders].sort((a, b) => {
    const aPinned = a.pinned === true ? 1 : 0;
    const bPinned = b.pinned === true ? 1 : 0;
    if (bPinned !== aPinned) return bPinned - aPinned;
    const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0) || a.name.localeCompare(b.name);
  });
}

type SidebarPlaylistRowProps = {
  playlist: Playlist;
  isDragOver: boolean;
  onNavigate: (path: string) => void;
  onEdit: (playlist: Playlist) => void;
  indent?: boolean;
  onDragStart?: (playlistId: string) => void;
  onDragEnd?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
};

function SidebarPlaylistRow({
  playlist,
  isDragOver,
  onNavigate,
  onEdit,
  indent = false,
  onDragStart,
  onDragEnd,
  onContextMenu,
}: Omit<SidebarPlaylistRowProps, "onDragOver" | "onDragLeave" | "onDrop">) {
  const bannerUrl = useImageUrl(playlist.bannerImageId);
  const hasBanner = Boolean(playlist.bannerImageId);
  
  const handleDragStart = (event: React.DragEvent) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-playlist-id", playlist.id);
    onDragStart?.(playlist.id);
  };

  const handleDragEnd = () => {
    onDragEnd?.();
  };

  const handleDragOverForTracks = (e: React.DragEvent) => {
    if (
      e.dataTransfer.types.includes("application/x-track-ids") ||
      e.dataTransfer.types.includes("Files")
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };

  return (
    <div
      className={`sidebar-playlist ${isDragOver ? "sidebar-playlist--drag-over" : ""} ${indent ? "sidebar-playlist--indent" : ""}`}
      data-playlist-id={playlist.id}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOverForTracks}
      onClick={() => onNavigate(`/playlist/${playlist.id}`)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(e);
      }}
    >
      {hasBanner && bannerUrl && (
        <div
          className="sidebar-playlist-banner"
          style={{ backgroundImage: `url(${bannerUrl})` }}
          aria-hidden
        />
      )}
      <span
        className="playlist-name"
        title={playlist.name}
      >
        {playlist.name.length > 24
          ? `${playlist.name.slice(0, 24)}…`
          : playlist.name}
      </span>
      <button
        className="playlist-settings"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onEdit(playlist);
        }}
        title="Edit playlist"
        aria-label="Edit playlist"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </svg>
      </button>
    </div>
  );
}

type SidebarFolderRowProps = {
  folder: PlaylistFolder;
  playlists: Playlist[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  isDragOver: boolean;
  onNavigate: (path: string) => void;
  onEdit: (folder: PlaylistFolder) => void;
  onPlaylistEdit: (playlist: Playlist) => void;
  dragOverPlaylistId: string | null;
  onPlaylistDrop?: (playlistId: string, folderId: string) => void;
  onFolderContextMenu?: (folder: PlaylistFolder, e: React.MouseEvent) => void;
  onPlaylistContextMenu?: (playlist: Playlist, e: React.MouseEvent) => void;
  onPlaylistDragStart?: (playlistId: string) => void;
  onPlaylistDragEnd?: () => void;
};

function SidebarFolderRow({
  folder,
  playlists,
  isExpanded,
  onToggleExpand,
  isDragOver,
  onNavigate,
  onEdit,
  onPlaylistEdit,
  dragOverPlaylistId,
  onPlaylistDrop,
  onFolderContextMenu,
  onPlaylistContextMenu,
  onPlaylistDragStart,
  onPlaylistDragEnd,
}: SidebarFolderRowProps) {
  const iconUrl = useImageUrl(folder.iconImageId);
  const bannerUrl = useImageUrl(folder.bannerImageId);
  const hasBanner = Boolean(folder.bannerImageId);
  const folderPlaylists = playlists.filter((p) => p.folderId === folder.id);
  const sortedFolderPlaylists = sortPlaylists(folderPlaylists);

  const handleDragOver = (event: React.DragEvent) => {
    const hasPlaylist = event.dataTransfer.types.includes("application/x-playlist-id");
    if (hasPlaylist) {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      if (!isExpanded) {
        onToggleExpand();
      }
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    const hasPlaylist = event.dataTransfer.types.includes("application/x-playlist-id");
    if (hasPlaylist) {
      event.preventDefault();
      event.stopPropagation();
      const playlistId = event.dataTransfer.getData("application/x-playlist-id");
      if (playlistId && onPlaylistDrop) {
        onPlaylistDrop(playlistId, folder.id);
      }
    }
  };

  return (
    <div className="sidebar-folder">
      <div
        className={`sidebar-folder-header ${isDragOver ? "sidebar-folder-header--drag-over" : ""}`}
        data-folder-id={folder.id}
        onClick={() => onNavigate(`/folder/${folder.id}`)}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onFolderContextMenu?.(folder, e);
        }}
      >
        {hasBanner && bannerUrl && (
          <div
            className="sidebar-folder-banner"
            style={{ backgroundImage: `url(${bannerUrl})` }}
            aria-hidden
          />
        )}
        <button
          className="sidebar-folder-toggle"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
          aria-expanded={isExpanded}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
            aria-hidden
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        {iconUrl ? (
          <img
            src={iconUrl}
            alt=""
            className="sidebar-folder-icon"
            aria-hidden
          />
        ) : null}
        <span
          className="playlist-name"
          title={folder.name}
        >
          {folder.name.length > 20
            ? `${folder.name.slice(0, 20)}…`
            : folder.name}
        </span>
        <button
          className="playlist-settings"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(folder);
          }}
          title="Edit folder"
          aria-label="Edit folder"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
        </button>
      </div>
      {isExpanded && (
        <div className="sidebar-folder-playlists">
          {sortedFolderPlaylists.map((playlist) => (
            <SidebarPlaylistRow
              key={playlist.id}
              playlist={playlist}
              isDragOver={dragOverPlaylistId === playlist.id}
              onNavigate={onNavigate}
              onEdit={onPlaylistEdit}
              indent
              onDragStart={onPlaylistDragStart}
              onDragEnd={onPlaylistDragEnd}
              onContextMenu={(e) => onPlaylistContextMenu?.(playlist, e)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type SidebarProps = {
  dragContext: DragContext;
  onNavigate: (path: string) => void;
};

export const Sidebar = ({ dragContext, onNavigate }: SidebarProps) => {
  const addFiles = useLibraryStore((state) => state.addFiles);
  const addFileHandles = useLibraryStore((state) => state.addFileHandles);
  const addFilePaths = useLibraryStore((state) => state.addFilePaths);
  const playlists = usePlaylistStore((state) => state.playlists);
  const folders = useFolderStore((state) => state.folders);
  const createPlaylist = usePlaylistStore((state) => state.createPlaylist);
  const addTracksToPlaylist = usePlaylistStore(
    (state) => state.addTracksToPlaylist
  );
  const updatePlaylist = usePlaylistStore((state) => state.updatePlaylist);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [editingFolder, setEditingFolder] = useState<PlaylistFolder | null>(null);
  const [dragOverPlaylistId, setDragOverPlaylistId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverSection, setDragOverSection] = useState(false);
  const [_draggingPlaylistId, setDraggingPlaylistId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [foldersCollapsed, setFoldersCollapsed] = useState(false);
  const [playlistsCollapsed, setPlaylistsCollapsed] = useState(false);
  const [playlistsContextMenu, setPlaylistsContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [foldersContextMenu, setFoldersContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [playlistRowContextMenu, setPlaylistRowContextMenu] = useState<{ x: number; y: number; playlist: Playlist | null } | null>(null);
  const [folderRowContextMenu, setFolderRowContextMenu] = useState<{ x: number; y: number; folder: PlaylistFolder } | null>(null);
  const [folderImportPreviewRoots, setFolderImportPreviewRoots] = useState<Awaited<ReturnType<typeof buildFolderImportPreview>> | null>(null);
  const [folderImportPreviewOpen, setFolderImportPreviewOpen] = useState(false);
  const [folderImportPending, setFolderImportPending] = useState<{ targetFolderId: string | undefined; looseFiles: File[] } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const isAnyContextMenuOpen =
    playlistsContextMenu || foldersContextMenu || playlistRowContextMenu || folderRowContextMenu;

  // Hide the bottom music bar while playlist or folder settings are open.
  useEffect(() => {
    const shouldHide = editingPlaylist !== null || editingFolder !== null;
    const body = document.body;
    if (shouldHide) {
      body.classList.add("player-bar-hidden");
    } else {
      body.classList.remove("player-bar-hidden");
    }
    return () => {
      body.classList.remove("player-bar-hidden");
    };
  }, [editingPlaylist, editingFolder]);

  useEffect(() => {
    if (!isAnyContextMenuOpen) return;
    const closeAll = () => {
      setPlaylistsContextMenu(null);
      setFoldersContextMenu(null);
      setPlaylistRowContextMenu(null);
      setFolderRowContextMenu(null);
    };
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current?.contains(e.target as Node)) return;
      closeAll();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    const handleScroll = () => closeAll();
    document.addEventListener("mousedown", handleClick, true);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClick, true);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [isAnyContextMenuOpen]);

  const sortedFolders = useMemo(() => sortFolders(folders), [folders]);
  const playlistsWithoutFolder = useMemo(
    () => sortPlaylists(playlists.filter((p) => !p.folderId)),
    [playlists]
  );

  const toggleFolderExpanded = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleSidebarDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const types = event.dataTransfer.types;
    const hasTracks = types.includes("application/x-track-ids");
    const hasPlaylist = types.includes("application/x-playlist-id");
    const hasFiles = types.includes("Files") || (event.dataTransfer.items?.length ?? 0) > 0;
    event.dataTransfer.dropEffect = (hasFiles || hasTracks) ? "copy" : "move";
    const playlistRow = (event.target as HTMLElement).closest?.(".sidebar-playlist");
    const folderRow = (event.target as HTMLElement).closest?.(".sidebar-folder-header");
    const playlistId = playlistRow?.getAttribute("data-playlist-id");
    const folderId = folderRow?.getAttribute("data-folder-id");
    
    if (hasPlaylist && folderId) {
      setDragOverFolderId(folderId);
      setDragOverPlaylistId(null);
      setDragOverSection(false);
      if (!expandedFolders.has(folderId)) {
        toggleFolderExpanded(folderId);
      }
    } else if (playlistId && (hasTracks || hasFiles)) {
      setDragOverPlaylistId(playlistId);
      setDragOverFolderId(null);
      setDragOverSection(false);
    } else if (folderId && (hasTracks || hasFiles)) {
      setDragOverFolderId(folderId);
      setDragOverPlaylistId(null);
      setDragOverSection(false);
    } else if (hasTracks || hasFiles) {
      setDragOverSection(true);
      setDragOverPlaylistId(null);
      setDragOverFolderId(null);
    } else if (hasPlaylist) {
      setDragOverSection(true);
      setDragOverPlaylistId(null);
      setDragOverFolderId(null);
    }
  };

  const handleSidebarDragLeave = (event: React.DragEvent) => {
    const related = event.relatedTarget as Node | null;
    if (!related || !event.currentTarget.contains(related)) {
      setDragOverSection(false);
      setDragOverPlaylistId(null);
      setDragOverFolderId(null);
    }
  };

  const processFileDrop = async (
    result: NonNullable<Awaited<ReturnType<typeof getFilesFromDataTransfer>>>
  ): Promise<string[]> => {
    if (result.kind === "files") {
      if (result.files.length === 0) return [];
      return addFiles(result.files);
    }
    return [];
  };

  const handlePlaylistDrop = async (playlistId: string, folderId: string | null) => {
    await updatePlaylist(playlistId, { folderId: folderId ?? null });
    // Ensure all drag-over visuals are cleared when a playlist drop completes.
    // Folder headers handle their own drop events and stop propagation, so the
    // sidebar-level onDrop handler does not always run.
    setDraggingPlaylistId(null);
    setDragOverPlaylistId(null);
    setDragOverFolderId(null);
    setDragOverSection(false);
  };

  const handleSidebarDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverPlaylistId(null);
    setDragOverFolderId(null);
    setDragOverSection(false);

    const types = event.dataTransfer.types;
    const hasTracks = types.includes("application/x-track-ids");
    const hasPlaylist = types.includes("application/x-playlist-id");
    let hasFiles = types.includes("Files") || (event.dataTransfer.items?.length ?? 0) > 0;
    if (!hasFiles && event.dataTransfer.files?.length) hasFiles = true;
    const playlistRow = (event.target as HTMLElement).closest?.(".sidebar-playlist");
    const folderRow = (event.target as HTMLElement).closest?.(".sidebar-folder-header");
    const playlistId = playlistRow?.getAttribute("data-playlist-id") ?? null;
    const folderId = folderRow?.getAttribute("data-folder-id") ?? null;

    if (hasPlaylist) {
      const draggedPlaylistId = event.dataTransfer.getData("application/x-playlist-id");
      if (draggedPlaylistId && folderId) {
        await handlePlaylistDrop(draggedPlaylistId, folderId);
      } else if (draggedPlaylistId && !folderId && !playlistId) {
        await handlePlaylistDrop(draggedPlaylistId, null);
      }
      setDraggingPlaylistId(null);
      return;
    }

    if (hasTracks) {
      const data = event.dataTransfer.getData("application/x-track-ids");
      if (!data || !playlistId) return;
      const trackIds = JSON.parse(data) as string[];
      await addTracksToPlaylist(playlistId, trackIds);
      dragContext.onDragEnd();
      return;
    }

    if (!hasFiles) return;

    const result = await getFilesFromDataTransfer(event.dataTransfer);
    if (!result) return;

    if (result.kind === "folder") {
      const targetFolderId = folderId ?? undefined;
      const roots = await buildFolderImportPreview(result);
      const totalPlaylists = roots.reduce((acc, r) => acc + r.entries.length, 0);

      if (totalPlaylists > 1) {
        setFolderImportPreviewRoots(roots);
        setFolderImportPending({ targetFolderId, looseFiles: result.files });
        setFolderImportPreviewOpen(true);
        return;
      }

      let firstPlaylistId: string | null = null;
      const basename = (p: string) => p.replace(/^.*[/\\]/, "") || p;

      if (result.directoryHandles.length > 0) {
        for (const dir of result.directoryHandles) {
          const subdirs = await getDirectSubdirectoryHandles(dir);
          const toProcess: { name: string; getHandles: () => Promise<FileSystemFileHandle[]> }[] =
            subdirs.length > 0
              ? subdirs.map((sub) => ({
                  name: sub.name,
                  getHandles: () => getAudioFileHandlesFromDirectory(sub),
                }))
              : [{ name: dir.name, getHandles: () => getAudioFileHandlesFromDirectory(dir) }];
          for (const { name, getHandles } of toProcess) {
            const handles = await getHandles();
            const trackIds = handles.length > 0 ? await addFileHandles(handles) : [];
            const playlist = await createPlaylist({ name });
            if (trackIds.length > 0) await addTracksToPlaylist(playlist.id, trackIds);
            if (!firstPlaylistId) firstPlaylistId = playlist.id;
          }
        }
      } else if (result.directoryPaths?.length && window.electronAPI?.listAudioPaths) {
        const listSubdirs = window.electronAPI.listDirectSubdirectories;
        for (const dir of result.directoryPaths) {
          const subdirPaths = listSubdirs ? await listSubdirs(dir.path) : [];
          const toProcess: { name: string; path: string }[] =
            subdirPaths.length > 0
              ? subdirPaths.map((p) => ({ name: basename(p), path: p }))
              : [{ name: dir.name, path: dir.path }];
          for (const { name, path: dirPath } of toProcess) {
            const paths = await window.electronAPI.listAudioPaths(dirPath);
            const trackIds = paths.length > 0 ? await addFilePaths(paths) : [];
            const playlist = await createPlaylist({ name });
            if (trackIds.length > 0) await addTracksToPlaylist(playlist.id, trackIds);
            if (!firstPlaylistId) firstPlaylistId = playlist.id;
          }
        }
      }

      if (result.files.length > 0) {
        const looseTrackIds = await addFiles(result.files);
        if (firstPlaylistId && looseTrackIds.length > 0) {
          await addTracksToPlaylist(firstPlaylistId, looseTrackIds);
        }
      }

      if (firstPlaylistId) {
        onNavigate(`/playlist/${firstPlaylistId}`);
      }
      return;
    }

    const trackIds = await processFileDrop(result);
    if (trackIds.length > 0 && playlistId) {
      await addTracksToPlaylist(playlistId, trackIds);
    }
  };

  return (
    <aside
      className={`sidebar ${dragOverSection || dragOverPlaylistId || dragOverFolderId ? "sidebar--drag-over" : ""}`}
      onDragOver={handleSidebarDragOver}
      onDragLeave={handleSidebarDragLeave}
      onDrop={handleSidebarDrop}
    >
      <div className="sidebar-actions">
        <div className="sidebar-actions-row">
          <button
            type="button"
            className="sidebar-action-icon"
            onClick={() => setIsFolderModalOpen(true)}
            title="Create folder"
            aria-label="Create folder"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
          </button>
          <button
            type="button"
            className="sidebar-action-icon"
            onClick={() => setIsPlaylistModalOpen(true)}
            title="Create playlist"
            aria-label="Create playlist"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 6h10M4 12h10M4 18h10" />
              <line x1="18" y1="8" x2="22" y2="8" />
              <line x1="20" y1="6" x2="20" y2="10" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          className="sidebar-liked-button"
          onClick={() => onNavigate("/liked")}
          title="Liked Songs"
          aria-label="Liked Songs"
        >
          <span className="sidebar-liked-icon" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </span>
          <span className="sidebar-liked-label">Liked Songs</span>
        </button>
      </div>
      <div
        className="sidebar-scroll"
        role="region"
        aria-label="Library navigation"
      >
        <div
          className={`sidebar-section ${foldersCollapsed ? "sidebar-section--collapsed" : ""} ${dragOverSection ? "sidebar-section--drag-over" : ""}`}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setFoldersContextMenu({ x: e.clientX, y: e.clientY });
          }}
        >
          <button
            type="button"
            className="sidebar-section-header"
            onClick={() => setFoldersCollapsed((prev) => !prev)}
            aria-expanded={!foldersCollapsed}
          >
            <span className="sidebar-section-title">Folders</span>
            <span
              className={`sidebar-section-chevron ${foldersCollapsed ? "sidebar-section-chevron--collapsed" : ""}`}
              aria-hidden
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </button>
          {!foldersCollapsed && (
            <div className="sidebar-playlists">
              {sortedFolders.map((folder) => (
                <SidebarFolderRow
                  key={folder.id}
                  folder={folder}
                  playlists={playlists}
                  isExpanded={expandedFolders.has(folder.id)}
                  onToggleExpand={() => toggleFolderExpanded(folder.id)}
                  isDragOver={dragOverFolderId === folder.id}
                  onNavigate={onNavigate}
                  onEdit={setEditingFolder}
                  onPlaylistEdit={setEditingPlaylist}
                  dragOverPlaylistId={dragOverPlaylistId}
                  onPlaylistDrop={handlePlaylistDrop}
                  onPlaylistDragStart={setDraggingPlaylistId}
                  onPlaylistDragEnd={() => setDraggingPlaylistId(null)}
                  onFolderContextMenu={(f, e) =>
                    setFolderRowContextMenu({ x: e.clientX, y: e.clientY, folder: f })
                  }
                  onPlaylistContextMenu={(playlist, e) =>
                    setPlaylistRowContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      playlist,
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
        <div
          className={`sidebar-section sidebar-section--fill ${playlistsCollapsed ? "sidebar-section--collapsed" : ""} ${dragOverSection ? "sidebar-section--drag-over" : ""}`}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPlaylistsContextMenu({ x: e.clientX, y: e.clientY });
          }}
        >
          <button
            type="button"
            className="sidebar-section-header"
            onClick={() => setPlaylistsCollapsed((prev) => !prev)}
            aria-expanded={!playlistsCollapsed}
          >
            <span className="sidebar-section-title">Playlists</span>
            <span
              className={`sidebar-section-chevron ${playlistsCollapsed ? "sidebar-section-chevron--collapsed" : ""}`}
              aria-hidden
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </button>
          {!playlistsCollapsed && (
            <div className="sidebar-playlists">
              {playlistsWithoutFolder.map((playlist) => (
                <SidebarPlaylistRow
                  key={playlist.id}
                  playlist={playlist}
                  isDragOver={dragOverPlaylistId === playlist.id}
                  onNavigate={onNavigate}
                  onEdit={setEditingPlaylist}
                  onDragStart={setDraggingPlaylistId}
                  onDragEnd={() => setDraggingPlaylistId(null)}
                  onContextMenu={(e) =>
                    setPlaylistRowContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      playlist,
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <SidebarArtistsButton onNavigate={onNavigate} />
      {playlistsContextMenu &&
        createPortal(
          <div
            ref={contextMenuRef}
            className="track-list-context-menu"
            style={{ left: playlistsContextMenu.x, top: playlistsContextMenu.y }}
            role="menu"
          >
            <button
              type="button"
              className="dropdown-item"
              role="menuitem"
              onClick={() => {
                setPlaylistsContextMenu(null);
                setIsPlaylistModalOpen(true);
              }}
            >
              Create playlist
            </button>
          </div>,
          document.body
        )}
      {foldersContextMenu &&
        createPortal(
          <div
            ref={contextMenuRef}
            className="track-list-context-menu"
            style={{ left: foldersContextMenu.x, top: foldersContextMenu.y }}
            role="menu"
          >
            <button
              type="button"
              className="dropdown-item"
              role="menuitem"
              onClick={() => {
                setFoldersContextMenu(null);
                setIsFolderModalOpen(true);
              }}
            >
              Create folder
            </button>
          </div>,
          document.body
        )}
      {playlistRowContextMenu &&
        createPortal(
          <div
            ref={contextMenuRef}
            className="track-list-context-menu"
            style={{
              left: playlistRowContextMenu.x,
              top: playlistRowContextMenu.y,
            }}
            role="menu"
          >
            {playlistRowContextMenu.playlist && (
              <button
                type="button"
                className="dropdown-item"
                role="menuitem"
                onClick={() => {
                  setPlaylistRowContextMenu(null);
                  setEditingPlaylist(playlistRowContextMenu.playlist);
                }}
              >
                Edit playlist
              </button>
            )}
            <button
              type="button"
              className="dropdown-item"
              role="menuitem"
              onClick={() => {
                setPlaylistRowContextMenu(null);
                setIsPlaylistModalOpen(true);
              }}
            >
              Create playlist
            </button>
          </div>,
          document.body
        )}
      {folderRowContextMenu &&
        createPortal(
          <div
            ref={contextMenuRef}
            className="track-list-context-menu"
            style={{
              left: folderRowContextMenu.x,
              top: folderRowContextMenu.y,
            }}
            role="menu"
          >
            <button
              type="button"
              className="dropdown-item"
              role="menuitem"
              onClick={() => {
                setFolderRowContextMenu(null);
                setEditingFolder(folderRowContextMenu.folder);
              }}
            >
              Edit folder
            </button>
            <button
              type="button"
              className="dropdown-item"
              role="menuitem"
              onClick={() => {
                setFolderRowContextMenu(null);
                setIsFolderModalOpen(true);
              }}
            >
              Create folder
            </button>
          </div>,
          document.body
        )}
      <CreatePlaylistModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        onCreated={(playlistId) => onNavigate(`/playlist/${playlistId}`)}
      />
      <EditPlaylistModal
        isOpen={editingPlaylist !== null}
        onClose={() => setEditingPlaylist(null)}
        playlist={editingPlaylist}
        onDeleted={() => onNavigate("/")}
      />
      <CreateFolderModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        onCreated={() => setIsFolderModalOpen(false)}
      />
      <EditFolderModal
        isOpen={editingFolder !== null}
        onClose={() => setEditingFolder(null)}
        folder={editingFolder}
        onDeleted={() => setEditingFolder(null)}
      />
      <FolderImportPreviewModal
        isOpen={folderImportPreviewOpen}
        onClose={() => {
          setFolderImportPreviewOpen(false);
          setFolderImportPreviewRoots(null);
          setFolderImportPending(null);
        }}
        roots={folderImportPreviewRoots ?? []}
        looseFilesCount={folderImportPending?.looseFiles.length ?? 0}
        onConfirm={async (entries: FolderImportPreviewEntry[]) => {
          const pending = folderImportPending;
          if (!pending) return;
          let firstPlaylistId: string | null = null;
          for (const entry of entries) {
            const trackIds = entry.getHandles
              ? await addFileHandles(await entry.getHandles())
              : entry.getPaths
                ? await addFilePaths(await entry.getPaths())
                : [];
            const playlist = await createPlaylist({
              name: entry.displayName,
            });
            if (trackIds.length > 0) await addTracksToPlaylist(playlist.id, trackIds);
            if (!firstPlaylistId) firstPlaylistId = playlist.id;
          }
          if (pending.looseFiles.length > 0) {
            const looseTrackIds = await addFiles(pending.looseFiles);
            if (firstPlaylistId && looseTrackIds.length > 0) {
              await addTracksToPlaylist(firstPlaylistId, looseTrackIds);
            }
          }
          if (firstPlaylistId) onNavigate(`/playlist/${firstPlaylistId}`);
        }}
      />
    </aside>
  );
};
