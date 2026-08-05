import { ApiError } from "@/services/api/apiClient";

export interface MinioPutResult {
  /** Null for a small-file single PUT, which never needs it — only a multipart part upload does (see completeMultipart()). */
  etag: string | null;
}

/**
 * Raw PUT straight to MinIO (via the write-side proxy), given a presigned
 * URL — deliberately bypasses apiClient: no JWT (the URL's own signature is
 * the auth), no `{success,data}` envelope (MinIO's own XML error body
 * instead). The first code in this codebase that calls a non-backend
 * origin, by design — direct-to-MinIO uploads are the entire point of this
 * flow (see the upload migration plan for why).
 *
 * Throws `ApiError` (same shape `apiClient` already throws, so the
 * existing `isTransient()`/offline-routing logic in bulk-upload-context.tsx
 * classifies it identically — 5xx/408/429 transient, everything else not —
 * with zero changes needed there) on any non-2xx response. A genuine
 * network-level failure (DNS, connection reset, CORS block) throws a plain
 * `TypeError` straight from `fetch()` itself, exactly like every other
 * network call in this app already does.
 */
export async function putToMinio(url: string, body: Blob, signal?: AbortSignal): Promise<MinioPutResult> {
  const response = await fetch(url, { method: "PUT", body, signal });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new ApiError(text || `MinIO PUT failed with status ${response.status}`, response.status);
  }

  return { etag: response.headers.get("ETag") };
}
