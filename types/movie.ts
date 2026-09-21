import type { ActorRef } from "@/types/actor";

export type MovieStatus =
  | "DRAFT"
  | "PROCESSING"
  | "PUBLISHED"
  | "ARCHIVED"
  | "UPLOADING"
  | "FAILED"
  | "READY_TO_PUBLISH";

export type AccessType = "FREE" | "SUBSCRIPTION";

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
  thumbnailUrl: string | null;
  genre: string;
  language: string;
  releaseYear: number;
  duration: number;
  accessType: AccessType;
  status: MovieStatus;
  rating: number;
  /** Set only for episodes — null means a standalone movie. */
  seriesId: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  categories: MovieCategoryRef[];
  /** The cast. Managed under Movies › Actors; see types/actor.ts. */
  actors: ActorRef[];
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
  /**
   * The whole cast, not a delta: the backend `set`s this list, so anyone
   * left out is removed from the film.
   */
  actorIds: string[];
  language: string;
  releaseYear: number;
  duration: number;
  /** 0–10, one decimal; 0 = not rated. Only the edit dialog sets it — upload never does. */
  rating?: number;
  accessType: AccessType;
  posterUrl?: string;
  coverUrl?: string;
  thumbnailUrl?: string;
}

export type UploadStage =
  | "idle"
  | "uploading-images"
  | "creating-movie"
  | "uploading-video"
  | "processing"
  | "published"
  | "error";
