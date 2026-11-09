import type { ActorRef } from "@/types/actor";
import type { AgeRating } from "@/lib/constants/movie-options";

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
  /** The English / default description, and the fallback when there is no Burmese one. Can be "" since a title may have only a Burmese text. */
  description: string;
  /** The Burmese description, typed by staff; null = none. Viewers on the Burmese app see it, the others see `description`. */
  descriptionMm: string | null;
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
  /** Null = not set. Episodes leave it empty. */
  director: string | null;
  /** Null = not set ("Unrated"). */
  ageRating: AgeRating | null;
  /** The movie TYPE ("Korean", "English"… — MEDIA_TYPES), null = not set. Episodes leave it empty: they follow the show. */
  country: string | null;
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
  /** The Burmese description; "" clears it (stored as null). Omit to leave it alone. */
  descriptionMm?: string;
  genre: string;
  categoryIds: string[];
  /**
   * The whole cast, not a delta: the backend `set`s this list, so anyone
   * left out is removed from the film.
   */
  actorIds: string[];
  language: string;
  /** The movie TYPE word; "" clears it (stored as null). Omit to leave it alone. */
  country?: string;
  /** "" clears it (stored as null). Omit to leave it alone. */
  director?: string;
  /** null clears it back to "not set". Omit to leave it alone. */
  ageRating?: AgeRating | null;
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
