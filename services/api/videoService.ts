import { apiClient } from "./apiClient";

export type VideoProcessingStatus = "UPLOADING" | "PROCESSING" | "READY" | "FAILED";

export interface VideoStatusInfo {
  id: string;
  status: VideoProcessingStatus;
  failureReason: string | null;
  duration: number | null;
  resolution: string | null;
  hlsMasterPath: string | null;
  renditions: { resolution: string; playlistPath: string }[] | null;
  createdAt: string;
  updatedAt: string;
}

export type VideoDiagnosisAction = "none" | "reprocess" | "replace";

export interface VideoDiagnosisCheck {
  /**
   * A stable machine key the UI maps to a label: `video_row`, `video_status`,
   * `original_object`, `hls_master`, `renditions_json`, `rendition:<res>`,
   * `segment_sample`, `cacheserver_master`, `subtitle_source:<label>`. An
   * unknown name (a newer backend) renders raw rather than breaking.
   */
  name: string;
  ok: boolean;
  /** English diagnostic text, shown verbatim like failureReason is — never carries credentials. */
  detail: string;
}

export interface VideoDiagnosis {
  ok: boolean;
  suggestedAction: VideoDiagnosisAction;
  checks: VideoDiagnosisCheck[];
}

export const videoService = {
  getProcessingStatus(movieId: string, signal?: AbortSignal) {
    return apiClient.get<VideoStatusInfo>(`/videos/status/${movieId}`, { signal });
  },

  /**
   * Staff-only playback diagnosis (MOVIES.EDIT): HEADs every object the
   * player would fetch and pulls the signed master through the cacheserver
   * the way a client would. Costs ~10 storage round-trips per call, so it
   * runs on demand only — never on dialog open.
   */
  diagnose(movieId: string, signal?: AbortSignal) {
    return apiClient.get<VideoDiagnosis>(`/videos/${movieId}/diagnose`, { signal });
  },
};
