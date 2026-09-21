import type { AccessType, Movie } from "./movie";

/** Show-level visibility — independent of episode MovieStatus. Users only ever see PUBLISHED series. */
export type SeriesStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED";

export interface Series {
  id: string;
  title: string;
  description: string;
  posterUrl: string | null;
  coverUrl: string | null;
  genre: string;
  language: string;
  releaseYear: number;
  /** Admin-set 0–10, same meaning as Movie.rating: 0 = not rated. */
  rating: number;
  /** One access type for the whole show — episodes are never gated individually. */
  accessType: AccessType;
  status: SeriesStatus;
  categories: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
}

/** List rows carry an episode count the detail shape doesn't. */
export interface SeriesListItem extends Series {
  episodeCount: number;
}

/** Seasons aren't rows anywhere — this is just "which season numbers exist, and how full is each." */
export interface SeasonSummary {
  seasonNumber: number;
  episodeCount: number;
}

/** One row in the admin's Series > Ready to Publish table — a Movie (episode) plus its owning series' title. */
export interface AdminEpisode extends Movie {
  seriesTitle: string | null;
}

export interface SeriesFormValues {
  title: string;
  description: string;
  genre: string;
  language: string;
  releaseYear: number;
  /** 0–10, one decimal; 0 clears it back to "not rated". */
  rating?: number;
  posterUrl?: string;
  coverUrl?: string;
  accessType?: AccessType;
  categoryIds?: string[];
}
