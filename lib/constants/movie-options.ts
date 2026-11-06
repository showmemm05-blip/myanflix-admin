export const GENRE_OPTIONS = [
  "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary",
  "Drama", "Family", "Fantasy", "History", "Horror", "Musical",
  "Mystery", "Romance", "Sci-Fi", "Thriller",
];

export const LANGUAGES = ["English", "Burmese", "Korean", "Japanese", "Hindi", "Chinese", "Spanish", "French"];

/**
 * The movie / series TYPE (owner, 2026-10-27: "English movies, Korean
 * movies…"). The backend keeps the plain word in the `country` field; the
 * phone app and the website show it as "Korean movie" / "Korean series" and
 * label exactly these words, so a new one needs their labels too.
 */
export const MEDIA_TYPES = ["English", "Korean", "Chinese", "Thai", "Japanese", "Indian", "Myanmar", "Other"] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];
