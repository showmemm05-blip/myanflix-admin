/**
 * Browser-side runtime probe for the bulk (pre-transcoded bundle) upload flow.
 *
 * A bulk-uploaded title is born as a placeholder row with `duration: 0` (the
 * API's unknown-runtime sentinel). Nothing on the server ever measured it, so
 * every such title rendered "0m". The uploader is the one place that holds a
 * real `File` handle for every asset in the bundle, so it measures the runtime
 * here and sends it WITH the placeholder POST — at row birth, where there is
 * structurally nothing to overwrite.
 *
 * Source order:
 *   1. Sum of `#EXTINF` in the rendition playlist named by master.m3u8's first
 *      variant (falling back to the highest rendition folder present). Exact
 *      for the HLS viewers actually play, instant (a 2 h film is ~50 KB of
 *      playlist), and independent of whether the browser can decode the
 *      source codec or whether the MP4 is faststart.
 *   2. A hidden <video> metadata read of original.mp4 with a hard timeout.
 *   3. null — the field is omitted and the row is born with 0 exactly as before.
 *
 * Nothing here may reject or block: every failure resolves null, the <video>
 * fallback is time-boxed, and the object URL is always revoked so a 10 GB
 * handle is never pinned for the life of the page.
 *
 * `secondsToMinutes` and the playlist helpers mirror backend
 * src/videos/duration.util.ts and src/subtitles/hls-subtitle-manifest.ts
 * byte-for-byte in behaviour, so the browser and the server's finalize-time
 * recovery agree about one title.
 */

/** 100 hours. Anything longer is a bad probe, not a runtime, and is discarded. Same constant as the backend DTO's @Max. */
export const MAX_DURATION_MINUTES = 6000;

/** Ceiling for the <video> fallback — a browser that neither errors nor loads must not stall the queue. */
export const VIDEO_PROBE_TIMEOUT_MS = 8000;

/** Highest first — mirrors the transcoder's tiers and the master's variant order. */
export const RENDITION_ORDER = ["1080p", "720p", "480p", "360p", "240p"] as const;

const MAX_DURATION_SECONDS = MAX_DURATION_MINUTES * 60;
const STREAM_INF = /^#EXT-X-STREAM-INF:/;
const EXTINF = /^#EXTINF:\s*([\d.]+)/;

interface BundleFile {
  /** Relative to the dropped folder root: `original.mp4`, `master.m3u8`, `1080p/index.m3u8`, … */
  relativePath: string;
  file: File;
}

/**
 * Seconds -> the whole minutes Movie.duration stores, or null when the value
 * is unusable (non-finite, <= 0, or over the sanity bound).
 *
 * ROUND, not ceil: runtimes are conventionally quoted that way (90:29 is
 * "90m"). FLOOR AT 1: 0 is the unknown sentinel and the API rejects it, so a
 * 40-second clip is 1m, never 0.
 */
export function secondsToMinutes(seconds: number | null | undefined): number | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_DURATION_SECONDS) {
    return null;
  }
  return Math.max(1, Math.round(seconds / 60));
}

/** Sum of a media playlist's EXTINF values, or null if it declares none. */
export function totalDurationFromMediaPlaylist(text: string): number | null {
  let total = 0;
  let seen = false;

  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const match = EXTINF.exec(line.trim());
    if (!match) continue;
    const value = Number.parseFloat(match[1]);
    if (!Number.isFinite(value)) continue;
    total += value;
    seen = true;
  }

  return seen ? total : null;
}

/** URI of the first variant a master lists (leading `./` stripped), or null. */
export function firstVariantUri(master: string): string | null {
  const lines = master.replace(/\r\n?/g, "\n").split("\n");
  const streamInf = lines.findIndex((line) => STREAM_INF.test(line));
  if (streamInf === -1) return null;

  for (const line of lines.slice(streamInf + 1)) {
    const uri = line.trim();
    if (uri !== "" && !uri.startsWith("#")) return uri.replace(/^\.\//, "");
  }
  return null;
}

/**
 * Reads the container's own duration through a detached <video> element.
 * Resolves the duration in seconds, or null on a decode error (Chrome fires
 * `error` rather than `loadedmetadata` when it has no decodable stream —
 * HEVC without hardware decode, AVI, some MKV) or when `timeoutMs` elapses
 * first. Never rejects.
 */
export function probeVideoFileDurationSeconds(
  file: File,
  timeoutMs: number = VIDEO_PROBE_TIMEOUT_MS,
): Promise<number | null> {
  if (typeof document === "undefined" || typeof URL === "undefined") return Promise.resolve(null);

  return new Promise<number | null>((resolve) => {
    let video: HTMLVideoElement | null = null;
    let url: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;

    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      if (video) {
        video.onloadedmetadata = null;
        video.onerror = null;
        video.removeAttribute("src");
        // Detaches the media resource so the blob is released right away.
        video.load();
      }
      if (url !== null) URL.revokeObjectURL(url);
    };

    // Only the first outcome counts — loadedmetadata, error and the timer race.
    const settle = (value: number | null) => {
      if (settled) return;
      settled = true;
      try {
        cleanup();
      } catch {
        // cleanup is best effort; the result is already decided
      } finally {
        resolve(value);
      }
    };

    try {
      video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      url = URL.createObjectURL(file);

      const element = video;
      element.onloadedmetadata = () => {
        const seconds = element.duration;
        settle(Number.isFinite(seconds) && seconds > 0 ? seconds : null);
      };
      element.onerror = () => settle(null);
      timer = setTimeout(() => settle(null), timeoutMs);

      element.src = url;
    } catch {
      settle(null);
    }
  });
}

/**
 * The rendition playlist to sum: whatever master.m3u8 names first, else the
 * highest rendition folder present in the bundle.
 */
async function findRenditionPlaylist(files: ReadonlyArray<BundleFile>): Promise<BundleFile | null> {
  const master = files.find((f) => f.relativePath === "master.m3u8");
  if (master) {
    const uri = firstVariantUri(await master.file.text());
    if (uri) {
      const named = files.find((f) => f.relativePath === uri);
      if (named) return named;
    }
  }

  for (const rendition of RENDITION_ORDER) {
    const candidate = files.find((f) => f.relativePath === `${rendition}/index.m3u8`);
    if (candidate) return candidate;
  }
  return null;
}

/**
 * Runtime in seconds of a dropped bundle, or null when it cannot be
 * measured. Input is `DroppedFolder.files` — raw relative paths, exactly as
 * read from the folder. Never throws.
 */
export async function probeBundleDurationSeconds(files: ReadonlyArray<BundleFile>): Promise<number | null> {
  try {
    const playlist = await findRenditionPlaylist(files);
    if (playlist) {
      const sum = totalDurationFromMediaPlaylist(await playlist.file.text());
      if (sum !== null && sum > 0) return sum;
    }

    const original = files.find((f) => f.relativePath === "original.mp4");
    if (original) return await probeVideoFileDurationSeconds(original.file);

    return null;
  } catch {
    return null;
  }
}
