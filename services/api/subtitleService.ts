import { apiClient } from "./apiClient";
import type { Subtitle } from "@/types/subtitle";

export const subtitleService = {
  getForVideo(videoId: string) {
    return apiClient.get<Subtitle[]>("/subtitles", { params: { videoId } });
  },

  upload(videoId: string, file: File, language: string, label: string, isDefault: boolean, signal?: AbortSignal) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("videoId", videoId);
    formData.append("language", language);
    formData.append("label", label);
    formData.append("isDefault", String(isDefault));
    return apiClient.post<Subtitle>("/subtitles", formData, { signal });
  },

  update(id: string, values: { language?: string; label?: string; isDefault?: boolean }) {
    return apiClient.patch<Subtitle>(`/subtitles/${id}`, values);
  },

  setDefault(id: string) {
    return apiClient.patch<Subtitle>(`/subtitles/${id}/set-default`);
  },

  remove(id: string) {
    return apiClient.delete<void>(`/subtitles/${id}`);
  },
};
