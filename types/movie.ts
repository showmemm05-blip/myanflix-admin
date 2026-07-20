export type MovieStatus = "DRAFT" | "PROCESSING" | "PUBLISHED" | "ARCHIVED";

export interface MovieCategoryRef {
  id: string;
  name: string;
}

export interface Movie {
  id: string;
  title: string;
  description: string;
  posterUrl: string | null;
  coverUrl: string | null;
  genre: string;
  language: string;
  releaseYear: number;
  duration: number;
  price: number;
  isPremium: boolean;
  status: MovieStatus;
  rating: number;
  categories: MovieCategoryRef[];
  createdAt: string;
  updatedAt: string;
}

export interface MovieCategory {
  id: string;
  name: string;
  description: string | null;
  movieCount: number;
}

export interface MovieUploadFormValues {
  title: string;
  description: string;
  genre: string;
  categoryIds: string[];
  language: string;
  releaseYear: number;
  duration: number;
  price: number;
  isPremium: boolean;
  posterUrl?: string;
  coverUrl?: string;
}

export type UploadStage =
  | "idle"
  | "uploading-images"
  | "creating-movie"
  | "uploading-video"
  | "processing"
  | "published"
  | "error";
