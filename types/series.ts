import type { AccessType, Movie } from "./movie";

export interface Series {
  id: string;
  title: string;
  description: string;
  posterUrl: string | null;
  coverUrl: string | null;
  genre: string;
  language: string;
  releaseYear: number;
  /** One access type for the whole show — episodes are never gated individually. */
  accessType: AccessType;
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
  posterUrl?: string;
  coverUrl?: string;
  accessType?: AccessType;
  categoryIds?: string[];
}
