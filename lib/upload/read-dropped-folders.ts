// Minimal ambient shape for the WebKit directory-entry APIs — not part of
// TypeScript's bundled DOM lib, but implemented in every Chromium/WebKit
// browser (Chrome, Edge, Safari) and required to walk dropped folders
// recursively, since a plain `drop` event's FileList doesn't carry
// directory structure the way `<input webkitdirectory>` does.
interface FileSystemEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
}
interface FileSystemFileEntry extends FileSystemEntry {
  file(success: (file: File) => void, error: (err: unknown) => void): void;
}
interface FileSystemDirectoryReader {
  readEntries(success: (entries: FileSystemEntry[]) => void, error: (err: unknown) => void): void;
}
interface FileSystemDirectoryEntry extends FileSystemEntry {
  createReader(): FileSystemDirectoryReader;
}

export interface DroppedFolder {
  folderName: string;
  files: { relativePath: string; file: File }[];
}

function readFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

/** Chrome's readEntries() only returns up to 100 entries per call — must keep calling until it returns empty. */
async function readDirectoryFully(entry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = entry.createReader();
  const all: FileSystemEntry[] = [];
  for (;;) {
    const batch = await readAllEntries(reader);
    if (batch.length === 0) break;
    all.push(...batch);
  }
  return all;
}

async function walk(entry: FileSystemEntry, prefix: string): Promise<{ relativePath: string; file: File }[]> {
  if (entry.isFile) {
    const file = await readFile(entry as FileSystemFileEntry);
    return [{ relativePath: `${prefix}${entry.name}`, file }];
  }
  if (entry.isDirectory) {
    const children = await readDirectoryFully(entry as FileSystemDirectoryEntry);
    const results: { relativePath: string; file: File }[] = [];
    for (const child of children) {
      results.push(...(await walk(child, `${prefix}${entry.name}/`)));
    }
    return results;
  }
  return [];
}

/**
 * Reads every top-level folder dropped onto a dropzone in one gesture (each
 * becomes one movie) and recursively walks each one's contents. Non-folder
 * items dropped alongside are ignored. relativePath is relative to each
 * folder's own root — the folder's own name is stripped, matching how the
 * classic `<input webkitdirectory>` picker's webkitRelativePath is handled.
 */
export async function readDroppedFolders(dataTransfer: DataTransfer): Promise<DroppedFolder[]> {
  const items = Array.from(dataTransfer.items);
  const topLevelEntries = items
    .map((item) =>
      item.kind === "file" && "webkitGetAsEntry" in item
        ? ((item as DataTransferItem & { webkitGetAsEntry(): FileSystemEntry | null }).webkitGetAsEntry() as FileSystemEntry | null)
        : null,
    )
    .filter((entry): entry is FileSystemDirectoryEntry => entry !== null && entry.isDirectory);

  const folders: DroppedFolder[] = [];
  for (const entry of topLevelEntries) {
    const files = await walk(entry, "");
    const stripped = files.map((f) => ({
      relativePath: f.relativePath.slice(entry.name.length + 1),
      file: f.file,
    }));
    folders.push({ folderName: entry.name, files: stripped });
  }
  return folders;
}

/**
 * A folder selected via `<input webkitdirectory>` keeps its own root folder
 * name as every one of its files' first path segment. Some browser/OS
 * combinations let the native picker multi-select several top-level
 * folders in one dialog (e.g. Cmd/Ctrl-click) — when that happens, the
 * resulting FileList is just every folder's files flattened together, each
 * still carrying its OWN first segment. Grouping by that first segment
 * (rather than assuming they all share one) is what makes multi-select
 * actually work here instead of silently merging everything into a single
 * movie — and it's a no-op (one group) when only one folder was picked.
 */
export function foldersFromFileList(fileList: FileList): DroppedFolder[] {
  const groups = new Map<string, { relativePath: string; file: File }[]>();

  for (const file of Array.from(fileList)) {
    const webkitPath = (file as File & { webkitRelativePath: string }).webkitRelativePath;
    if (!webkitPath) continue;
    const parts = webkitPath.split("/");
    const folderName = parts[0] || "movie";
    const relativePath = parts.slice(1).join("/");
    if (!groups.has(folderName)) groups.set(folderName, []);
    groups.get(folderName)!.push({ relativePath, file });
  }

  return Array.from(groups.entries()).map(([folderName, files]) => ({ folderName, files }));
}

/** "the_great_escape" / "The-Great-Escape" -> "The Great Escape". */
export function extractTitleFromFolderName(folderName: string): string {
  const cleaned = folderName.replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned || folderName;
}

/**
 * Maps a path relative to a movie folder's own root onto the storage
 * relativePath the backend expects (see backend UploadsService's
 * parseBundleStructure() — the fixed contract: original.mp4 at the root,
 * everything else nested under "hls/" to match StorageService's existing
 * MinIO key convention, which streaming already depends on unchanged).
 */
export function mapLocalPathToRelativePath(localPath: string): string {
  if (localPath === "original.mp4") return "original.mp4";
  if (localPath === "master.m3u8") return "hls/master.m3u8";
  if (localPath.startsWith("subtitles/")) return localPath;
  return `hls/${localPath}`;
}
