import { API_ORIGIN, apiClient } from "./apiClient";
import type { PaginatedResponse } from "@/types/api";
import type {
  Ad,
  AdAnalyticsAds,
  AdAnalyticsByDate,
  AdAnalyticsOverview,
  AdAnalyticsQuery,
  AdQuery,
  AdSettings,
  AttachAdVideoInput,
  CreateAdInput,
  UpdateAdInput,
  UpdateAdSettingsInput,
} from "@/types/ad";

/**
 * A corner picture's URL as an <img> can use it: the backend sends an
 * absolute one, but a relative `/storage/…` path (as the upload routes
 * answer) is resolved against the API origin rather than the admin's own.
 */
function withAbsoluteImage(ad: Ad): Ad {
  if (!ad.imageUrl || /^https?:\/\//i.test(ad.imageUrl)) return ad;
  return { ...ad, imageUrl: `${API_ORIGIN}${ad.imageUrl}` };
}

/**
 * The "Advertisements" admin pages: video ads (before the movie and at
 * breaks), corner pictures, the playback rules and the analytics. ADS.VIEW
 * reads, ADS.MANAGE changes; the backend audits every change. The video
 * itself never passes through here — it goes straight to MinIO with the
 * presign/multipart routes (lib/upload/upload-ad-video.ts), and
 * `attachVideo` then tells the backend to verify and keep it. A corner
 * picture is small (≤ 3 MB) and goes to the backend in one multipart POST.
 */
export const adService = {
  /** One page of ads, newest first; `status` filters on the computed live state, `format` on the type. */
  async getAds(query: AdQuery = {}) {
    const page = await apiClient.get<PaginatedResponse<Ad>>("/ads/admin", { params: query });
    return { ...page, items: page.items.map(withAbsoluteImage) };
  },

  /** Also the way to get a FRESH signed video URL — each read signs anew. */
  async getAd(id: string) {
    return withAbsoluteImage(await apiClient.get<Ad>(`/ads/admin/${id}`));
  },

  /** `format` is chosen here once; it cannot be changed later. */
  async createAd(input: CreateAdInput) {
    return withAbsoluteImage(await apiClient.post<Ad>("/ads/admin", input));
  },

  /**
   * Absent = keep, null = clear. `isActive: true` is refused until the video
   * (or the corner picture) is there; the other format's fields and
   * `format` itself are refused.
   */
  async updateAd(id: string, input: UpdateAdInput) {
    return withAbsoluteImage(await apiClient.patch<Ad>(`/ads/admin/${id}`, input));
  },

  /** Deletes the ad, its video and its play history. */
  deleteAd(id: string) {
    return apiClient.delete<void>(`/ads/admin/${id}`);
  },

  /**
   * After the MP4 landed in the ad's staging folder: the backend checks it
   * is an MP4 of 1–600 s, remuxes it so phones start it before the whole
   * file is down, and keeps it — together with the skip fields, checked
   * against the new length. Untimed on purpose — a 200 MB remux takes a
   * while — so a slow one is not reported as unreachable.
   */
  async attachVideo(id: string, input: AttachAdVideoInput) {
    return withAbsoluteImage(await apiClient.post<Ad>(`/ads/admin/${id}/video/attach`, input));
  },

  /**
   * A corner ad's picture (PNG / JPG / WebP / GIF, at most 3 MB), field
   * `file`. The backend checks the bytes and the shape, keeps a GIF or an
   * animated WebP byte for byte, replaces the previous picture and answers
   * the ad. Untimed like every write; `signal` is the dialog's Cancel.
   */
  async uploadImage(id: string, file: File, signal?: AbortSignal) {
    const formData = new FormData();
    formData.append("file", file);
    return withAbsoluteImage(await apiClient.post<Ad>(`/ads/admin/${id}/image`, formData, { signal }));
  },

  // ---------------------------------------------------------- playback rules
  // GET (ADS.VIEW) / PUT (ADS.MANAGE) /ads/admin/settings — the rules for
  // EVERY ad (the master switch, same movie again, the break interval, who
  // gets breaks and corner ads). The players read them from each session, so
  // a save is live within about 30 seconds (the backend's cache) for movies
  // opened from then on, with no app update. The PUT replaces the whole row.

  getSettings() {
    return apiClient.get<AdSettings>("/ads/admin/settings");
  },

  updateSettings(input: UpdateAdSettingsInput) {
    return apiClient.put<AdSettings>("/ads/admin/settings", input);
  },

  // --------------------------------------------------------------- analytics
  // GET /ads/admin/analytics/* — aggregates for the Analytics page, all
  // ADS.VIEW. Periods are Myanmar calendar dates the page works out in the
  // browser (components/lottery/analytics/period.ts); the backend converts
  // them to UTC instants. Absent dates = the last 7 full Myanmar days;
  // absent `placement` = before the movie, breaks and corner together.

  getAnalyticsOverview(query: AdAnalyticsQuery) {
    return apiClient.get<AdAnalyticsOverview>("/ads/admin/analytics/overview", { params: query });
  },

  /** Every ad with its counts in the period — takes NO adId. */
  getAnalyticsAds(query: Pick<AdAnalyticsQuery, "from" | "to" | "placement">) {
    return apiClient.get<AdAnalyticsAds>("/ads/admin/analytics/ads", { params: query });
  },

  getAnalyticsByDate(query: AdAnalyticsQuery) {
    return apiClient.get<AdAnalyticsByDate>("/ads/admin/analytics/by-date", { params: query });
  },
};
