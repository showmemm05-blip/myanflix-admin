export interface Series {
  id: string;
  title: string;
  description: string;
  posterUrl: string | null;
  coverUrl: string | null;
  genre: string;
  language: string;
  releaseYear: number;
  /** One price for the whole show — episodes are never sold individually. */
  price: number;
  isPremium: boolean;
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

export interface SeriesFormValues {
  title: string;
  description: string;
  genre: string;
  language: string;
  releaseYear: number;
  posterUrl?: string;
  coverUrl?: string;
  price?: number;
  isPremium?: boolean;
  categoryIds?: string[];
}
