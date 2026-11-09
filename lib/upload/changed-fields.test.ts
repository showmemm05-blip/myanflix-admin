/**
 * What the Edit movie dialog sends on Save (lib/upload/changed-fields.ts):
 * only the fields staff changed, compared with the movie as it was loaded —
 * nothing changed is an empty body, the cast and the categories go out only
 * when someone was really added or removed, the status only when it was
 * changed, and the values the API would refuse (an emptied title, genre or
 * language, a runtime of 0) are never sent. A list that does go out is
 * rebuilt on the server's copy of the moment, so it carries staff's own
 * edit and nothing that arrived meanwhile is wiped.
 *
 * Runs on Node's own test runner: `npm test`.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { Movie } from "@/types/movie";
import type { MovieFormSnapshot } from "./changed-fields";

// Node loads a relative TypeScript file only when the path carries its full
// extension, which tsc does not allow in an `import` — so load it this way.
const load = createRequire(import.meta.url);
const { buildMovieUpdate, hasChanges, rebaseIds } = load("./changed-fields.ts") as typeof import("./changed-fields");

function movie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: "movie-1",
    title: "Inception",
    description: "A thief who enters people's dreams takes one last job.",
    descriptionMm: null,
    posterUrl: "http://cache.example/images/movie/tmdb-poster.jpg",
    coverUrl: "http://cache.example/images/movie/tmdb-cover.jpg",
    thumbnailUrl: null,
    genre: "Sci-Fi",
    language: "English",
    releaseYear: 2010,
    duration: 148,
    accessType: "SUBSCRIPTION",
    status: "READY_TO_PUBLISH",
    rating: 0,
    director: "Christopher Nolan",
    ageRating: "PG13",
    country: "English",
    seriesId: null,
    seasonNumber: null,
    episodeNumber: null,
    categories: [
      { id: "cat-scifi", name: "Sci-Fi" },
      { id: "cat-action", name: "Action" },
    ],
    actors: [
      { id: "actor-1", name: "Leonardo DiCaprio", imageUrl: null },
      { id: "actor-2", name: "Elliot Page", imageUrl: null },
    ],
    createdAt: "2026-11-06T07:00:00.000Z",
    updatedAt: "2026-11-06T07:05:00.000Z",
    ...overrides,
  };
}

/** The form exactly as it opens on a movie: every field the dialog shows, unchanged. */
function formOf(loaded: Movie, overrides: MovieFormSnapshot = {}): MovieFormSnapshot {
  return {
    title: loaded.title,
    description: loaded.description,
    descriptionMm: loaded.descriptionMm ?? "",
    genre: loaded.genre,
    language: loaded.language,
    country: loaded.country,
    director: loaded.director ?? "",
    ageRating: loaded.ageRating,
    releaseYear: loaded.releaseYear,
    duration: loaded.duration,
    rating: loaded.rating,
    accessType: loaded.accessType,
    status: loaded.status,
    categoryIds: loaded.categories.map((c) => c.id),
    actorIds: loaded.actors.map((a) => a.id),
    ...overrides,
  };
}

describe("buildMovieUpdate — nothing changed", () => {
  it("an untouched form is an empty body, so the dialog closes without a request", () => {
    const loaded = movie();
    const payload = buildMovieUpdate(loaded, formOf(loaded));
    assert.deepEqual(payload, {});
    assert.equal(hasChanges(payload), false);
  });

  it("the same cast and categories in another order are not a change", () => {
    const loaded = movie();
    const payload = buildMovieUpdate(
      loaded,
      formOf(loaded, { categoryIds: ["cat-action", "cat-scifi"], actorIds: ["actor-2", "actor-1"] }),
    );
    assert.deepEqual(payload, {});
  });

  it("a stray space around a text is not an edit", () => {
    const loaded = movie();
    const payload = buildMovieUpdate(
      loaded,
      formOf(loaded, { title: "  Inception ", description: `${loaded.description}\n`, director: "Christopher Nolan " }),
    );
    assert.deepEqual(payload, {});
  });

  it("a title born with empty details keeps them unsent — the API refuses an empty genre or language", () => {
    const loaded = movie({ description: "", genre: "", language: "", director: null, ageRating: null, country: null, duration: 0 });
    const payload = buildMovieUpdate(loaded, formOf(loaded, { duration: 0 }));
    assert.deepEqual(payload, {});
  });

  it("an empty form snapshot edits nothing", () => {
    assert.deepEqual(buildMovieUpdate(movie(), {}), {});
  });
});

describe("buildMovieUpdate — what staff changed", () => {
  it("sends one changed text, trimmed, and nothing else", () => {
    const loaded = movie();
    const payload = buildMovieUpdate(loaded, formOf(loaded, { title: " Inception (Director's Cut) " }));
    assert.deepEqual(payload, { title: "Inception (Director's Cut)" });
    assert.equal(hasChanges(payload), true);
  });

  it("the Burmese description goes out when typed, and as \"\" when cleared", () => {
    const loaded = movie();
    assert.deepEqual(buildMovieUpdate(loaded, formOf(loaded, { descriptionMm: "အိပ်မက်ထဲ ဝင်သူ" })), {
      descriptionMm: "အိပ်မက်ထဲ ဝင်သူ",
    });

    const withBurmese = movie({ descriptionMm: "အိပ်မက်ထဲ ဝင်သူ" });
    assert.deepEqual(buildMovieUpdate(withBurmese, formOf(withBurmese, { descriptionMm: "   " })), {
      descriptionMm: "",
    });
  });

  it("the English description can be emptied — a title may have only a Burmese one", () => {
    const loaded = movie({ descriptionMm: "အိပ်မက်ထဲ ဝင်သူ" });
    assert.deepEqual(buildMovieUpdate(loaded, formOf(loaded, { description: "" })), { description: "" });
  });

  it("clearing the type or the director sends \"\", clearing the age rating sends null", () => {
    const loaded = movie();
    assert.deepEqual(buildMovieUpdate(loaded, formOf(loaded, { country: null, director: "", ageRating: null })), {
      country: "",
      director: "",
      ageRating: null,
    });
  });

  it("setting the type, director and age rating of a title that had none", () => {
    const loaded = movie({ country: null, director: null, ageRating: null });
    assert.deepEqual(
      buildMovieUpdate(loaded, formOf(loaded, { country: "Korean", director: "Bong Joon-ho", ageRating: "R" })),
      { country: "Korean", director: "Bong Joon-ho", ageRating: "R" },
    );
  });

  it("an emptied title, genre or language is never sent", () => {
    const loaded = movie();
    assert.deepEqual(buildMovieUpdate(loaded, formOf(loaded, { title: "  ", genre: "", language: "" })), {});
  });

  it("numbers: a new year and runtime go out, a runtime below 1 or not whole does not", () => {
    const loaded = movie();
    assert.deepEqual(buildMovieUpdate(loaded, formOf(loaded, { releaseYear: 2011, duration: 150, rating: 8.5 })), {
      releaseYear: 2011,
      duration: 150,
      rating: 8.5,
    });
    assert.deepEqual(buildMovieUpdate(loaded, formOf(loaded, { duration: 0 })), {});
    assert.deepEqual(buildMovieUpdate(loaded, formOf(loaded, { duration: Number.NaN, releaseYear: Number.NaN })), {});
  });

  it("the status and the access type only when changed", () => {
    const loaded = movie();
    assert.deepEqual(buildMovieUpdate(loaded, formOf(loaded, { status: "PUBLISHED" })), { status: "PUBLISHED" });
    assert.deepEqual(buildMovieUpdate(loaded, formOf(loaded, { accessType: "FREE" })), { accessType: "FREE" });
  });

  it("the cast and the categories go out whole, and only the list that changed", () => {
    const loaded = movie();
    assert.deepEqual(buildMovieUpdate(loaded, formOf(loaded, { actorIds: ["actor-1", "actor-2", "actor-3"] })), {
      actorIds: ["actor-1", "actor-2", "actor-3"],
    });
    assert.deepEqual(buildMovieUpdate(loaded, formOf(loaded, { categoryIds: ["cat-scifi"] })), {
      categoryIds: ["cat-scifi"],
    });
    assert.deepEqual(buildMovieUpdate(loaded, formOf(loaded, { actorIds: [] })), { actorIds: [] });
  });

  it("a picture only when a new one was uploaded", () => {
    const loaded = movie();
    assert.deepEqual(buildMovieUpdate(loaded, formOf(loaded, { posterUrl: loaded.posterUrl ?? undefined })), {});
    assert.deepEqual(
      buildMovieUpdate(loaded, formOf(loaded, { posterUrl: "http://cache.example/images/movie/own-poster.jpg" })),
      { posterUrl: "http://cache.example/images/movie/own-poster.jpg" },
    );
  });
});

describe("buildMovieUpdate — an episode", () => {
  const episode = movie({
    seriesId: "series-1",
    seasonNumber: 1,
    episodeNumber: 3,
    country: null,
    director: null,
    ageRating: null,
  });

  /** The dialog hides the type, the rating and the three movie-only controls for an episode. */
  function episodeForm(overrides: MovieFormSnapshot = {}): MovieFormSnapshot {
    const { country: _country, rating: _rating, director: _director, ageRating: _ageRating, language: _language, ...shown } =
      formOf(episode);
    return { ...shown, seasonNumber: 1, episodeNumber: 3, ...overrides };
  }

  it("fields the form does not show are never sent", () => {
    assert.deepEqual(buildMovieUpdate(episode, episodeForm()), {});
  });

  it("a moved episode sends only its new position", () => {
    assert.deepEqual(buildMovieUpdate(episode, episodeForm({ episodeNumber: 4 })), { episodeNumber: 4 });
    assert.deepEqual(buildMovieUpdate(episode, episodeForm({ seasonNumber: 2, episodeNumber: 1 })), {
      seasonNumber: 2,
      episodeNumber: 1,
    });
  });
});

describe("rebaseIds — a list edit on top of what the server holds now", () => {
  const tmdbCast = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "a10"];

  it("opened while the folder uploaded: staff add one actor, TMDB added ten meanwhile — eleven go out", () => {
    assert.deepEqual(rebaseIds([], ["mine"], tmdbCast), [...tmdbCast, "mine"]);
  });

  it("staff removed one: only that one leaves, the others of the fresh list stay", () => {
    const loaded = ["a1", "a2"];
    assert.deepEqual(rebaseIds(loaded, ["a1"], ["a1", "a2", "a3"]), ["a1", "a3"]);
  });

  it("an add and a removal together", () => {
    assert.deepEqual(rebaseIds(["a1", "a2"], ["a2", "mine"], ["a1", "a2", "a3"]), ["a2", "a3", "mine"]);
  });

  it("nothing changed on the server: exactly what the form holds", () => {
    assert.deepEqual(rebaseIds(["a1", "a2"], ["a1", "a2", "mine"], ["a1", "a2"]), ["a1", "a2", "mine"]);
    assert.deepEqual(rebaseIds(["a1", "a2"], [], ["a1", "a2"]), []);
  });

  it("someone staff kept but the server dropped meanwhile is not brought back", () => {
    assert.deepEqual(rebaseIds(["old", "a1"], ["old", "a1", "mine"], ["a1"]), ["a1", "mine"]);
  });

  it("an actor staff added that the server added too is there once", () => {
    assert.deepEqual(rebaseIds([], ["a1"], ["a1", "a2"]), ["a1", "a2"]);
  });

  it("the same for categories: ticking one keeps the ones TMDB matched", () => {
    assert.deepEqual(rebaseIds([], ["cat-action"], ["cat-scifi", "cat-thriller"]), [
      "cat-scifi",
      "cat-thriller",
      "cat-action",
    ]);
  });
});
