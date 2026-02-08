/** Audio extensions used when scanning dropped folders (must match track utils). */
const AUDIO_EXTENSIONS = new Set([
  "mp3", "wav", "ogg", "flac", "aac", "m4a", "webm",
]);

/** File System Access API: directory handle with entries() (not in all TS libs). */
type DirHandleWithEntries = FileSystemDirectoryHandle & {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
};

function isAudioFileName(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return AUDIO_EXTENSIONS.has(ext);
}

/**
 * Get direct child directory handles only (one level, no recursion).
 * Used to treat each subfolder as a separate playlist when dropping a parent folder.
 */
export async function getDirectSubdirectoryHandles(
  dirHandle: FileSystemDirectoryHandle
): Promise<FileSystemDirectoryHandle[]> {
  const out: FileSystemDirectoryHandle[] = [];
  const withEntries = dirHandle as DirHandleWithEntries;
  try {
    for await (const [, handle] of withEntries.entries()) {
      if (handle.kind === "directory") {
        out.push(handle as FileSystemDirectoryHandle);
      }
    }
  } catch {
    // Permission or read errors
  }
  return out;
}

/**
 * Recursively collect all audio file handles from a directory (and subdirectories).
 * Works in browser and Electron when a folder is dropped via File System Access API.
 */
export async function getAudioFileHandlesFromDirectory(
  dirHandle: FileSystemDirectoryHandle
): Promise<FileSystemFileHandle[]> {
  const out: FileSystemFileHandle[] = [];
  const withEntries = dirHandle as DirHandleWithEntries;
  try {
    for await (const [name, handle] of withEntries.entries()) {
      if (handle.kind === "directory") {
        const sub = await getAudioFileHandlesFromDirectory(
          handle as FileSystemDirectoryHandle
        );
        out.push(...sub);
      } else if (
        handle.kind === "file" &&
        isAudioFileName(name)
      ) {
        out.push(handle as FileSystemFileHandle);
      }
    }
  } catch {
    // Permission or read errors: return what we have
  }
  return out;
}

export type FolderDropResult = {
  kind: "folder";
  folderName: string;
  /** Directory handle(s) – use getAudioFileHandlesFromDirectory to get file handles. */
  directoryHandles: FileSystemDirectoryHandle[];
  /** Electron only: directory paths when getAsFileSystemHandle is unavailable. Use listAudioPaths + addFilePaths. */
  directoryPaths?: { path: string; name: string }[];
  files: File[];
};

/** One playlist-to-be in the import preview. */
export type FolderImportPreviewEntry = {
  id: string;
  /** Editable display name (playlist name). */
  displayName: string;
  originalName: string;
  songCount: number;
  songNames: string[];
  getHandles?: () => Promise<FileSystemFileHandle[]>;
  getPaths?: () => Promise<string[]>;
};

/** One root folder in the preview tree (e.g. one dropped folder with N subfolders = N entries). */
export type FolderImportPreviewRoot = {
  rootName: string;
  entries: FolderImportPreviewEntry[];
};

/**
 * Build preview tree from a folder drop result. Each root = one dropped folder;
 * each entry = one playlist that will be created. Loads song counts and names.
 */
export async function buildFolderImportPreview(
  result: FolderDropResult
): Promise<FolderImportPreviewRoot[]> {
  const basename = (p: string) => p.replace(/^.*[/\\]/, "") || p;
  const roots: FolderImportPreviewRoot[] = [];

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
      const entries: FolderImportPreviewEntry[] = [];
      for (const { name, getHandles } of toProcess) {
        const handles = await getHandles();
        const songNames = handles.map((h) => h.name);
        entries.push({
          id: crypto.randomUUID(),
          displayName: name,
          originalName: name,
          songCount: songNames.length,
          songNames,
          getHandles,
        });
      }
      roots.push({ rootName: dir.name, entries });
    }
  } else if (result.directoryPaths?.length && typeof window !== "undefined") {
    const api = (window as Window & { electronAPI?: { listAudioPaths?: (p: string) => Promise<string[]>; listDirectSubdirectories?: (p: string) => Promise<string[]> } }).electronAPI;
    const listSubdirs = api?.listDirectSubdirectories;
    for (const dir of result.directoryPaths) {
      const subdirPaths = listSubdirs ? await listSubdirs(dir.path) : [];
      const toProcess: { name: string; path: string }[] =
        subdirPaths.length > 0
          ? subdirPaths.map((p) => ({ name: basename(p), path: p }))
          : [{ name: dir.name, path: dir.path }];
      const entries: FolderImportPreviewEntry[] = [];
      if (api?.listAudioPaths) {
        for (const { name, path: dirPath } of toProcess) {
          const paths = await api.listAudioPaths(dirPath);
          const songNames = paths.map((p) => basename(p));
          entries.push({
            id: crypto.randomUUID(),
            displayName: name,
            originalName: name,
            songCount: songNames.length,
            songNames,
            getPaths: () => Promise.resolve(paths),
          });
        }
      }
      if (entries.length > 0) roots.push({ rootName: dir.name, entries });
    }
  }

  return roots;
}

type DataTransferItemWithHandle = DataTransferItem & {
  getAsFileSystemHandle?(): Promise<FileSystemHandle | undefined>;
};

/**
 * Must be called in the same tick as the drop event. Starts all handle reads
 * without awaiting so the DataTransfer is not cleared before every item is read.
 */
export async function getFilesFromDataTransfer(
  dataTransfer: DataTransfer
): Promise<
  | {
      kind: "files";
      files: File[];
    }
  | FolderDropResult
  | null
> {
  const items = Array.from(dataTransfer.items);
  if (items.length === 0) {
    const files = Array.from(dataTransfer.files);
    if (files.length === 0) return null;
    return { kind: "files", files };
  }

  const directoryHandles: FileSystemDirectoryHandle[] = [];
  const files: File[] = [];
  let folderName: string | null = null;

  const electronAPI = typeof window !== "undefined" ? (window as Window & { electronAPI?: { getPathForFile?: (f: File) => string; statPath?: (p: string) => Promise<{ isDirectory: boolean }> } }).electronAPI : undefined;
  const basename = (p: string) => p.replace(/^.*[/\\]/, "") || p;
  /** Collect (file, path) in same tick so path is available after DataTransfer is cleared. */
  const filePathPairs: { file: File; path: string }[] = [];

  // Start all getAsFileSystemHandle() calls in the same tick (do not await in loop),
  // and synchronously get File + path for Electron fallback.
  const handlePromises: Promise<FileSystemHandle | undefined>[] = [];
  const entryFlags: boolean[] = [];
  for (const item of items) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (electronAPI?.getPathForFile && file) {
      const p = electronAPI.getPathForFile(file);
      if (p) filePathPairs.push({ file, path: p });
    }
    const entry = item.webkitGetAsEntry?.();
    if (entry?.isDirectory) {
      const handlePromise = (item as DataTransferItemWithHandle).getAsFileSystemHandle?.();
      if (handlePromise) {
        entryFlags.push(true);
        handlePromises.push(handlePromise);
      } else {
        entryFlags.push(false);
        handlePromises.push(Promise.resolve(undefined));
      }
    } else {
      entryFlags.push(false);
      handlePromises.push(Promise.resolve(undefined));
      if (file) files.push(file);
    }
  }

  const handleResults = await Promise.all(handlePromises);
  let flagIndex = 0;
  for (const handle of handleResults) {
    if (entryFlags[flagIndex++] && handle && "kind" in handle && handle.kind === "directory") {
      if (!folderName) folderName = handle.name;
      directoryHandles.push(handle as FileSystemDirectoryHandle);
    }
  }

  if (directoryHandles.length > 0) {
    return {
      kind: "folder",
      folderName: folderName || "Folder",
      directoryHandles,
      files,
    };
  }

  // Electron fallback: use paths collected synchronously and detect directories (getAsFileSystemHandle often fails for drops).
  if (electronAPI?.statPath && filePathPairs.length > 0) {
    const directoryPaths: { path: string; name: string }[] = [];
    const dirPathSet = new Set<string>();
    for (const { path: filePath } of filePathPairs) {
      try {
        const stat = await electronAPI.statPath(filePath);
        if (stat.isDirectory) {
          directoryPaths.push({ path: filePath, name: basename(filePath) });
          dirPathSet.add(filePath);
        }
      } catch {
        // not a directory or not accessible
      }
    }
    if (directoryPaths.length > 0) {
      const looseFiles = filePathPairs
        .filter(({ path: p }) => !dirPathSet.has(p))
        .map(({ file }) => file);
      return {
        kind: "folder",
        folderName: directoryPaths[0].name,
        directoryHandles: [],
        directoryPaths,
        files: looseFiles,
      };
    }
  }

  if (files.length > 0) {
    return { kind: "files", files };
  }

  return null;
}
