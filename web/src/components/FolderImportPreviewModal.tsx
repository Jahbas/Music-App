import { useState, useCallback, useEffect, useRef } from "react";
import { Modal } from "./Modal";
import type { FolderImportPreviewRoot, FolderImportPreviewEntry } from "../utils/folderDrop";

type FolderImportPreviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  roots: FolderImportPreviewRoot[];
  looseFilesCount?: number;
  onConfirm: (entries: FolderImportPreviewEntry[]) => void;
};

export function FolderImportPreviewModal({
  isOpen,
  onClose,
  roots,
  looseFilesCount = 0,
  onConfirm,
}: FolderImportPreviewModalProps) {
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && roots.length > 0) {
      const map: Record<string, string> = {};
      const allIds = new Set<string>();
      for (const root of roots) {
        for (const e of root.entries) {
          map[e.id] = e.displayName;
          allIds.add(e.id);
        }
      }
      setDisplayNames(map);
      setSelectedIds(allIds);
      setExpandedIds(new Set());
      setEditingEntryId(null);
    }
  }, [isOpen, roots]);

  useEffect(() => {
    if (editingEntryId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingEntryId]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setDisplayName = useCallback((id: string, name: string) => {
    setDisplayNames((prev) => ({ ...prev, [id]: name }));
  }, []);

  const startRename = useCallback((id: string) => {
    setEditingEntryId(id);
  }, []);

  const commitRename = useCallback((id: string) => {
    setEditingEntryId((current) => (current === id ? null : current));
  }, []);

  const handleNameKeyDown = useCallback(
    (id: string, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitRename(id);
      }
      if (e.key === "Escape") {
        setDisplayName(id, displayNames[id] ?? "");
        setEditingEntryId(null);
      }
    },
    [commitRename, displayNames, setDisplayName]
  );

  const handleConfirm = () => {
    const selected = new Set(selectedIds);
    const entries: FolderImportPreviewEntry[] = [];
    for (const root of roots) {
      for (const e of root.entries) {
        if (!selected.has(e.id)) continue;
        entries.push({
          ...e,
          displayName: (displayNames[e.id] ?? e.displayName).trim() || e.originalName,
        });
      }
    }
    if (entries.length === 0) return;
    onConfirm(entries);
    onClose();
  };

  const totalPlaylists = roots.reduce((acc, r) => acc + r.entries.length, 0);
  const selectedCount = selectedIds.size;
  const showAsTree = roots.length > 1 || roots.some((r) => r.entries.length > 1);
  const canImport = selectedCount > 0;

  return (
    <Modal
      title="Import folders"
      isOpen={isOpen}
      onClose={onClose}
      className="folder-import-preview-modal"
    >
      <p className="folder-import-preview-intro">
        {selectedCount}/{totalPlaylists} selected
        {looseFilesCount > 0 && ` · ${looseFilesCount} loose → first`}
      </p>
      <div className="folder-import-preview-tree" role="tree" aria-label="Folder structure">
        {roots.map((root) => (
          <div key={root.rootName} className="folder-import-preview-root">
            {showAsTree && roots.length > 1 && (
              <div className="folder-import-preview-root-label">{root.rootName}</div>
            )}
            <ul className="folder-import-preview-list">
              {root.entries.map((entry) => {
                const isSelected = selectedIds.has(entry.id);
                const isExpanded = expandedIds.has(entry.id);
                const isEditing = editingEntryId === entry.id;
                const name = (displayNames[entry.id] ?? entry.displayName).trim() || entry.originalName;
                return (
                  <li
                    key={entry.id}
                    className={`folder-import-preview-entry ${!isSelected ? "folder-import-preview-entry--unselected" : ""}`}
                  >
                    <div className="folder-import-preview-row">
                      <input
                        type="checkbox"
                        className="folder-import-preview-checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelected(entry.id)}
                        aria-label={isSelected ? `Exclude ${name} from import` : `Include ${name} in import`}
                        title={isSelected ? "Exclude from import" : "Include in import"}
                      />
                      <button
                        type="button"
                        className="folder-import-preview-expand"
                        onClick={() => toggleExpanded(entry.id)}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? "Collapse songs" : "Expand to see songs"}
                        title={entry.songCount ? `${entry.songCount} song(s)` : "No audio files"}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={isExpanded ? "folder-import-preview-chevron-open" : ""}
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                      <div className="folder-import-preview-name-wrap">
                        {isEditing ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            className="folder-import-preview-name"
                            value={displayNames[entry.id] ?? entry.displayName}
                            onChange={(e) => setDisplayName(entry.id, e.target.value)}
                            onBlur={() => commitRename(entry.id)}
                            onKeyDown={(e) => handleNameKeyDown(entry.id, e)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Rename playlist`}
                          />
                        ) : (
                          <>
                            <span className="folder-import-preview-name-display" title={name}>
                              {name}
                            </span>
                            <button
                              type="button"
                              className="folder-import-preview-rename-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                startRename(entry.id);
                              }}
                              aria-label={`Rename ${name}`}
                            >
                              Rename
                            </button>
                          </>
                        )}
                      </div>
                      <span className="folder-import-preview-count" aria-hidden>
                        {entry.songCount} song{entry.songCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {isExpanded && (
                      <div className="folder-import-preview-songs-panel">
                        <div className="folder-import-preview-songs-header">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18V5l12-2v13" />
                            <circle cx="6" cy="18" r="3" />
                            <circle cx="18" cy="16" r="3" />
                          </svg>
                          Songs in this playlist
                        </div>
                        <ul className="folder-import-preview-songs" role="group" aria-label="Songs in playlist">
                          {entry.songNames.length === 0 ? (
                            <li className="folder-import-preview-song-item folder-import-preview-song-item--empty">
                              No audio files
                            </li>
                          ) : (
                            entry.songNames.map((name, i) => (
                              <li key={`${entry.id}-${i}`} className="folder-import-preview-song-item">
                                {name}
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="folder-import-preview-actions">
        <span className="folder-import-preview-selected-count" aria-live="polite">
          {selectedCount} of {totalPlaylists} selected
        </span>
        <button type="button" className="ghost-button" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={handleConfirm}
          disabled={!canImport}
        >
          Import
        </button>
      </div>
    </Modal>
  );
}
