export const GENRE_OPTIONS = [
  "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary",
  "Drama", "Family", "Fantasy", "History", "Horror", "Musical",
  "Mystery", "Romance", "Sci-Fi", "Thriller",
];

/**
 * The language words of a movie / series (`language` holds the display word,
 * never a code). `Thai` joined with the TMDB details (2026-11-06): the
 * backend fills this field from TMDB's original language and keeps the same
 * list in backend/src/tmdb/house-words.ts, so a word added here goes there too.
 */
export const LANGUAGES = ["English", "Burmese", "Korean", "Japanese", "Hindi", "Chinese", "Spanish", "French", "Thai"];

/**
 * The movie / series TYPE (owner, 2026-10-27: "English movies, Korean
 * movies…"). The backend keeps the plain word in the `country` field; the
 * phone app and the website show it as "Korean movie" / "Korean series" and
 * label exactly these words, so a new one needs their labels too.
 */
export const MEDIA_TYPES = ["English", "Korean", "Chinese", "Thai", "Japanese", "Indian", "Myanmar", "Other"] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];

/**
 * A movie's age rating, as the backend's `AgeRating` enum stores it: without
 * punctuation (PG13, NC17). Null on the movie means "not set". Series and
 * episodes have none.
 */
export const AGE_RATINGS = ["G", "PG", "PG13", "R", "NC17"] as const;

export type AgeRating = (typeof AGE_RATINGS)[number];

/** How each rating is written for people — the hyphen the enum drops. Not translated: these are the ratings' own names. */
export const AGE_RATING_LABELS: Record<AgeRating, string> = {
  G: "G",
  PG: "PG",
  PG13: "PG-13",
  R: "R",
  NC17: "NC-17",
};
