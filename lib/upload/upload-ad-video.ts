import { uploadSingleFileDirect } from "./upload-single-file";

/**
 * Uploads ONE ad video (an MP4) straight to MinIO and reports byte progress
 * — the ad form's half of attaching a video. The file lands in the ad's
 * private staging folder (`temp/ads/<adId>/video.mp4`, decided server-side
 * by ResourceUploadTypeRegistry's "ad" entry, which needs ADS.MANAGE); it
 * only becomes the ad's video once `adService.attachVideo` has checked it.
 */

/** ResourceUploadTypeRegistry's "ad" entry keys off this. */
export const AD_VIDEO_RESOURCE_TYPE = "ad";

/**
 * The one file name the registry accepts for an ad: whatever the admin
 * picked is uploaded under this name, and attach asks for the same path.
 */
export const AD_VIDEO_RELATIVE_PATH = "video.mp4";

export interface UploadAdVideoOptions {
  adId: string;
  file: File;
  /** Called with 0-100 as bytes land, throttled to ~4x a second. */
  onProgress?: (percent: number) => void;
  /** The multipart session id, once one is opened — see uploadSingleFileDirect. */
  onSession?: (sessionId: string) => void;
  signal: AbortSignal;
}

export function uploadAdVideo({ adId, file, onProgress, onSession, signal }: UploadAdVideoOptions): Promise<void> {
  return uploadSingleFileDirect({
    resourceType: AD_VIDEO_RESOURCE_TYPE,
    resourceId: adId,
    relativePath: AD_VIDEO_RELATIVE_PATH,
    file,
    onProgress,
    onSession,
    signal,
  });
}
