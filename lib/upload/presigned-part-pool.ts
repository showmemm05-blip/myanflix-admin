import { uploadService } from "@/services/api/uploadService";

// Requesting ~2x the part-upload concurrency at a time keeps a batch
// request from becoming its own bottleneck (one-at-a-time would serialize
// every worker behind a round trip) while never sharing one expiry across
// an entire multi-thousand-part file (all-upfront would do exactly that —
// see the upload migration plan's presigned-URL-strategy section).
const WINDOW_MULTIPLIER = 2;

/**
 * Sliding-window cache of presigned part-upload URLs for one multipart
 * session, issued just-in-time in batches and refilled as the window
 * drains. Never persisted (e.g. to localStorage) — a resumed upload always
 * gets a fresh pool, since URLs expire and MinIO's own part list (not any
 * client-side cache) is the source of truth for what's already landed.
 */
export class PresignedPartUrlPool {
  private readonly urls = new Map<number, string>();
  private readonly inFlight = new Map<number, Promise<string>>();

  constructor(
    private readonly sessionId: string,
    private readonly concurrency: number,
  ) {}

  /**
   * Resolves to the presigned URL for `partNumber` — fetching it (and
   * prefetching the rest of the current window from `remainingPartNumbers`)
   * if not already cached.
   */
  async getUrl(partNumber: number, remainingPartNumbers: number[]): Promise<string> {
    const cached = this.urls.get(partNumber);
    if (cached) return cached;

    const alreadyFetching = this.inFlight.get(partNumber);
    if (alreadyFetching) return alreadyFetching;

    const windowSize = this.concurrency * WINDOW_MULTIPLIER;
    const batch = [
      partNumber,
      ...remainingPartNumbers.filter((n) => n !== partNumber && !this.urls.has(n)),
    ].slice(0, windowSize);

    const promise = uploadService
      .multipartGetPartUrls(this.sessionId, batch)
      .then(({ parts }) => {
        for (const part of parts) this.urls.set(part.partNumber, part.url);
        const url = this.urls.get(partNumber);
        if (!url) throw new Error(`Backend did not return a presigned URL for part ${partNumber}`);
        return url;
      })
      .finally(() => {
        this.inFlight.delete(partNumber);
      });

    this.inFlight.set(partNumber, promise);
    return promise;
  }

  /** Call after a 403 (expired presigned URL) so the next getUrl() for this part fetches a fresh one instead of reusing the dead cached URL. */
  invalidate(partNumber: number): void {
    this.urls.delete(partNumber);
  }
}
