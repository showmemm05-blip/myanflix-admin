export type SubtitleFormat = "SRT" | "VTT" | "ASS";

export interface Subtitle {
  id: string;
  videoId: string;
  language: string;
  label: string;
  format: SubtitleFormat;
  objectKey: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
