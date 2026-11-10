/**
 * What a title still lacks before it is published
 * (components/movies/missingDetails.ts): a poster, a description in either
 * language and a category are "must have"; the banner, the actors, the
 * director and the age rating are "good to have"; a series is never asked
 * for a director or an age rating, an episode for nothing at all. The line
 * is amber, green or — while TMDB is still looking — one grey sentence, and
 * Publish asks first only when something in "must have" is missing. Also:
 * what a save leaves stored when the form is behind the server, and which
 * of two answers about one movie is the newer one.
 *
 * Runs on Node's own test runner: `npm test`. The words come from the real
 * translations, which import through the `@/` alias Node does not know, so a
 * resolve hook maps it to the admin root before they are loaded.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import nodeModule, { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Movie } from "@/types/movie";
import type { Series } from "@/types/series";
import type { MissingDetails, MissingFormInput, MissingSaveInput } from "./missingDetails";

const ADMIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// The installed @types/node predates `module.registerHooks` (Node ≥ 22.15),
// so the little of its shape this file uses is typed here.
interface ResolveResult {
  url: string;
  shortCircuit?: boolean;
}
type ResolveHook = (
  specifier: string,
  context: object,
  nextResolve: (specifier: string, context: object) => ResolveResult,
) => ResolveResult;
const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: { resolve: ResolveHook }) => void;
};

// tsconfig's `@/*` → `./*`, for Node: `@/lib/x` becomes <admin>/lib/x.ts.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const base = path.join(ADMIN_ROOT, specifier.slice(2));
    const file =
      [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")].find((candidate) => existsSync(candidate)) ?? base;
    return { url: pathToFileURL(file).href, shortCircuit: true };
  },
});

// Node loads a relative TypeScript file only when the path carries its full
// extension, which tsc does not allow in an `import` — so load it this way,
// after the hook above is in place.
const load = createRequire(import.meta.url);
const {
  GOOD_TO_HAVE_KEYS,
  MISSING_LIST_SEPARATOR,
  MUST_HAVE_KEYS,
  SERIES_GOOD_TO_HAVE_KEYS,
  anythingMissing,
  createAnswerOrder,
  getFromTmdbOffered,
  missingAfterSave,
  missingBoxWords,
  missingFormDetails,
  missingKeyLabel,
  missingKindOfMovie,
  missingLineState,
  missingLineWords,
  missingListText,
  missingMovieDetails,
  missingMovieDetailsOrNull,
  missingSeriesDetails,
  publishQuestionNeeded,
  publishQuestionWords,
  sameMissingDetails,
  saveWillPublish,
  seriesPublishDescription,
} = load("./missingDetails.ts") as typeof import("./missingDetails");
const { translations } = load("@/lib/i18n/translations") as typeof import("@/lib/i18n/translations");
const { en, mm } = translations;

/** A movie with every checked detail in place. */
function movie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: "movie-1",
    title: "Deadpool & Wolverine",
    description: "A listless Wade Wilson toils away in civilian life.",
    descriptionMm: null,
    posterUrl: "http://cache.example/images/movie/poster.jpg",
    coverUrl: "http://cache.example/images/movie/cover.jpg",
    thumbnailUrl: null,
    genre: "Action",
    language: "English",
    releaseYear: 2024,
    duration: 128,
    accessType: "SUBSCRIPTION",
    status: "READY_TO_PUBLISH",
    rating: 0,
    director: "Shawn Levy",
    ageRating: "R",
    country: "English",
    seriesId: null,
    seasonNumber: null,
    episodeNumber: null,
    categories: [{ id: "cat-action", name: "Action" }],
    actors: [{ id: "actor-1", name: "Ryan Reynolds", imageUrl: null }],
    createdAt: "2026-11-09T07:00:00.000Z",
    updatedAt: "2026-11-09T07:05:00.000Z",
    ...overrides,
  };
}

/** A fresh upload TMDB did not find: nothing but a name and a video. */
const BARE = {
  posterUrl: null,
  coverUrl: null,
  description: "",
  descriptionMm: null,
  categories: [],
  actors: [],
  director: null,
  ageRating: null,
} satisfies Partial<Movie>;

/** A series with every checked detail in place. */
function series(overrides: Partial<Series> = {}): Series {
  return {
    id: "series-1",
    title: "Squid Game",
    description: "Hundreds of cash-strapped players accept a strange invitation.",
    descriptionMm: null,
    posterUrl: "http://cache.example/images/series/poster.jpg",
    coverUrl: "http://cache.example/images/series/cover.jpg",
    genre: "Thriller",
    language: "Korean",
    country: "Korean",
    releaseYear: 2021,
    rating: 0,
    accessType: "SUBSCRIPTION",
    status: "DRAFT",
    categories: [{ id: "cat-thriller", name: "Thriller" }],
    actors: [{ id: "actor-2", name: "Lee Jung-jae", imageUrl: null }],
    createdAt: "2026-11-09T07:00:00.000Z",
    updatedAt: "2026-11-09T07:05:00.000Z",
    ...overrides,
  };
}

/** The Edit movie form as it opens on a movie with everything in place. */
function form(overrides: Partial<MissingFormInput> = {}): MissingFormInput {
  return {
    posterUrl: "http://cache.example/images/movie/poster.jpg",
    posterFile: null,
    coverUrl: "http://cache.example/images/movie/cover.jpg",
    coverFile: null,
    description: "A listless Wade Wilson toils away in civilian life.",
    descriptionMm: "",
    categoryIds: ["cat-action"],
    actorIds: ["actor-1"],
    director: "Shawn Levy",
    ageRating: "R",
    ...overrides,
  };
}

/** The form of a fresh upload nothing was filled in for. */
const EMPTY_FORM: MissingFormInput = {
  posterUrl: null,
  posterFile: null,
  coverUrl: null,
  coverFile: null,
  description: "",
  descriptionMm: "",
  categoryIds: [],
  actorIds: [],
  director: "",
  ageRating: null,
};

const NOTHING: MissingDetails = { mustHave: [], goodToHave: [] };

describe("the keys and their order", () => {
  it("must have: poster, description, category", () => {
    assert.deepEqual([...MUST_HAVE_KEYS], ["poster", "description", "categories"]);
  });

  it("good to have: banner, actors, director, age rating — a series only the first two", () => {
    assert.deepEqual([...GOOD_TO_HAVE_KEYS], ["cover", "cast", "director", "ageRating"]);
    assert.deepEqual([...SERIES_GOOD_TO_HAVE_KEYS], ["cover", "cast"]);
  });
});

describe("missingMovieDetails — a movie as stored", () => {
  it("everything in place: nothing is missing", () => {
    assert.deepEqual(missingMovieDetails(movie()), NOTHING);
  });

  it("a bare upload lacks all seven, each list in its fixed order", () => {
    assert.deepEqual(missingMovieDetails(movie(BARE)), {
      mustHave: ["poster", "description", "categories"],
      goodToHave: ["cover", "cast", "director", "ageRating"],
    });
  });

  it("a poster is an address with something in it: null, '' and spaces are no poster", () => {
    for (const posterUrl of [null, "", "   "]) {
      assert.deepEqual(missingMovieDetails(movie({ posterUrl })).mustHave, ["poster"], JSON.stringify(posterUrl));
    }
  });

  it("the banner is judged the same way, and is only good to have", () => {
    for (const coverUrl of [null, "", " \n "]) {
      assert.deepEqual(
        missingMovieDetails(movie({ coverUrl })),
        { mustHave: [], goodToHave: ["cover"] },
        JSON.stringify(coverUrl),
      );
    }
  });

  it("one description is enough: Burmese only, or English only", () => {
    const burmeseOnly = movie({ description: "", descriptionMm: "ဝိတ်ဝီလ်ဆန်၏ ဘဝသစ်။" });
    assert.deepEqual(missingMovieDetails(burmeseOnly), NOTHING);
    assert.deepEqual(missingMovieDetails(movie({ descriptionMm: null })), NOTHING);
  });

  it("no description when both are empty or only spaces", () => {
    assert.deepEqual(missingMovieDetails(movie({ description: "", descriptionMm: null })).mustHave, ["description"]);
    assert.deepEqual(missingMovieDetails(movie({ description: "  ", descriptionMm: " \n" })).mustHave, [
      "description",
    ]);
  });

  it("a category and an actor need at least one entry", () => {
    assert.deepEqual(missingMovieDetails(movie({ categories: [] })), { mustHave: ["categories"], goodToHave: [] });
    assert.deepEqual(missingMovieDetails(movie({ actors: [] })), { mustHave: [], goodToHave: ["cast"] });
  });

  it("the director is text: null, '' and spaces are none", () => {
    for (const director of [null, "", "   "]) {
      assert.deepEqual(missingMovieDetails(movie({ director })).goodToHave, ["director"], JSON.stringify(director));
    }
  });

  it("the age rating is set or not: null and '' are not", () => {
    assert.deepEqual(missingMovieDetails(movie({ ageRating: null })).goodToHave, ["ageRating"]);
    const blank = movie({ ageRating: "" as unknown as Movie["ageRating"] });
    assert.deepEqual(missingMovieDetails(blank).goodToHave, ["ageRating"]);
    assert.deepEqual(missingMovieDetails(movie({ ageRating: "PG13" })).goodToHave, []);
  });

  it("an answer from an older server that leaves fields out never throws", () => {
    const old = { posterUrl: null, description: "A story.", seriesId: null } as unknown as Movie;
    assert.deepEqual(missingMovieDetails(old), {
      mustHave: ["poster", "categories"],
      goodToHave: ["cover", "cast", "director", "ageRating"],
    });
  });

  it("the lists keep their order whatever is missing", () => {
    const some = movie({ categories: [], posterUrl: null, ageRating: null, coverUrl: null });
    assert.deepEqual(missingMovieDetails(some), {
      mustHave: ["poster", "categories"],
      goodToHave: ["cover", "ageRating"],
    });
  });
});

describe("an episode is asked for nothing", () => {
  const episode = movie({ ...BARE, seriesId: "series-1", seasonNumber: 1, episodeNumber: 3 });

  it("two empty lists, however bare the row is", () => {
    assert.deepEqual(missingMovieDetails(episode), NOTHING);
    assert.equal(publishQuestionNeeded(missingMovieDetails(episode)), false);
  });

  it("and null for the places that draw, so no green 'Ready' shows on it", () => {
    assert.equal(missingMovieDetailsOrNull(episode), null);
    assert.deepEqual(missingMovieDetailsOrNull(movie({ posterUrl: null })), { mustHave: ["poster"], goodToHave: [] });
    assert.equal(missingKindOfMovie(episode), "episode");
    assert.equal(missingKindOfMovie(movie()), "movie");
  });
});

describe("missingSeriesDetails — a series as stored", () => {
  it("everything in place: nothing is missing, though a series has no director or age rating", () => {
    assert.deepEqual(missingSeriesDetails(series()), NOTHING);
  });

  it("a bare series lacks the same three, and only banner and actors beside", () => {
    const bare = series({ posterUrl: null, coverUrl: null, description: "", categories: [], actors: [] });
    assert.deepEqual(missingSeriesDetails(bare), {
      mustHave: ["poster", "description", "categories"],
      goodToHave: ["cover", "cast"],
    });
  });

  it("a series made by hand: a description, no poster and no category yet", () => {
    const handMade = series({ posterUrl: null, coverUrl: null, categories: [] });
    assert.deepEqual(missingSeriesDetails(handMade), { mustHave: ["poster", "categories"], goodToHave: ["cover"] });
  });

  it("a Burmese description alone is a description; a cast left out by an older answer is no cast", () => {
    assert.deepEqual(missingSeriesDetails(series({ description: " ", descriptionMm: "ကစားပွဲ။" })), NOTHING);
    const old = series({ actors: undefined as unknown as Series["actors"] });
    assert.deepEqual(missingSeriesDetails(old), { mustHave: [], goodToHave: ["cast"] });
  });
});

describe("missingFormDetails — what the edit form holds now", () => {
  it("an untouched form of a complete movie: nothing is missing", () => {
    assert.deepEqual(missingFormDetails("movie", form()), NOTHING);
  });

  it("an empty form lacks all seven, in order", () => {
    assert.deepEqual(missingFormDetails("movie", EMPTY_FORM), {
      mustHave: ["poster", "description", "categories"],
      goodToHave: ["cover", "cast", "director", "ageRating"],
    });
  });

  it("a picked picture file counts as present before it is saved", () => {
    const picked = { ...EMPTY_FORM, posterFile: { name: "poster.jpg" }, coverFile: { name: "banner.jpg" } };
    assert.deepEqual(missingFormDetails("movie", picked), {
      mustHave: ["description", "categories"],
      goodToHave: ["cast", "director", "ageRating"],
    });
  });

  it("a cleared picture is missing: no stored address left and no file", () => {
    assert.deepEqual(missingFormDetails("movie", form({ posterUrl: null })).mustHave, ["poster"]);
    assert.deepEqual(missingFormDetails("movie", form({ posterUrl: "  " })).mustHave, ["poster"]);
    assert.deepEqual(missingFormDetails("movie", form({ coverUrl: undefined })).goodToHave, ["cover"]);
  });

  it("the list gets shorter as staff fill things in", () => {
    let now: MissingFormInput = { ...EMPTY_FORM };
    assert.equal(missingFormDetails("movie", now).mustHave.length, 3);
    now = { ...now, descriptionMm: "ဇာတ်လမ်းအကျဉ်း" };
    assert.deepEqual(missingFormDetails("movie", now).mustHave, ["poster", "categories"]);
    now = { ...now, categoryIds: ["cat-action"] };
    assert.deepEqual(missingFormDetails("movie", now).mustHave, ["poster"]);
    now = { ...now, posterFile: { name: "poster.jpg" } };
    assert.deepEqual(missingFormDetails("movie", now).mustHave, []);
    now = { ...now, actorIds: ["actor-1"], director: "Shawn Levy", ageRating: "R", coverFile: {} };
    assert.deepEqual(missingFormDetails("movie", now), NOTHING);
  });

  it("typed spaces are not a description or a director", () => {
    const spaces = form({ description: "   ", descriptionMm: "  ", director: " " });
    assert.deepEqual(missingFormDetails("movie", spaces), { mustHave: ["description"], goodToHave: ["director"] });
  });

  it("a series form has no director or age rating and is not asked for them", () => {
    const seriesForm: MissingFormInput = {
      posterUrl: null,
      posterFile: null,
      coverUrl: null,
      coverFile: null,
      description: "A show.",
      descriptionMm: "",
      categoryIds: [],
      actorIds: [],
    };
    assert.deepEqual(missingFormDetails("series", seriesForm), {
      mustHave: ["poster", "categories"],
      goodToHave: ["cover", "cast"],
    });
  });

  it("an episode's form is asked for nothing", () => {
    assert.deepEqual(missingFormDetails("episode", EMPTY_FORM), NOTHING);
  });
});

describe("missingAfterSave — a save from a form that is behind the server", () => {
  // The form was opened on the bare upload; TMDB has filled the movie in
  // since, and the form does not show it.
  const filled = movie();
  const nothingSent: MissingSaveInput = {};

  it("a save that only adds the Burmese description keeps what TMDB stored: nothing is missing, no question", () => {
    const after = missingAfterSave(filled, { descriptionMm: "ဇာတ်လမ်းအကျဉ်း" });
    assert.deepEqual(after, NOTHING);
    assert.equal(publishQuestionWords(en, "movie", filled.title, after), null);
    // The form itself still lacks them — which is what must not be asked about.
    const formSays = missingFormDetails("movie", { ...EMPTY_FORM, descriptionMm: "ဇာတ်လမ်းအကျဉ်း" });
    assert.deepEqual(formSays.mustHave, ["poster", "categories"]);
  });

  it("a save that sends nothing the rule reads leaves the stored movie as it is", () => {
    assert.deepEqual(missingAfterSave(filled, nothingSent), NOTHING);
    assert.deepEqual(missingAfterSave(movie(BARE), nothingSent), missingMovieDetails(movie(BARE)));
  });

  it("what staff emptied is missing after the save, whatever the server holds", () => {
    assert.deepEqual(missingAfterSave(filled, { description: "", descriptionMm: "" }).mustHave, ["description"]);
    // One box emptied, the other still stored: a description stays.
    const both = movie({ descriptionMm: "ဇာတ်လမ်းအကျဉ်း" });
    assert.deepEqual(missingAfterSave(both, { description: "" }), NOTHING);
    assert.deepEqual(missingAfterSave(filled, { director: "", ageRating: null }).goodToHave, ["director", "ageRating"]);
  });

  it("a list goes out whole: the list sent is the list stored", () => {
    assert.deepEqual(missingAfterSave(filled, { categoryIds: [] }).mustHave, ["categories"]);
    assert.deepEqual(missingAfterSave(filled, { actorIds: [] }).goodToHave, ["cast"]);
    const bare = movie(BARE);
    assert.deepEqual(missingAfterSave(bare, { categoryIds: ["cat-action"], actorIds: ["actor-1"] }), {
      mustHave: ["poster", "description"],
      goodToHave: ["cover", "director", "ageRating"],
    });
  });

  it("a picked picture file counts when the server has none", () => {
    const bare = movie({ posterUrl: null, coverUrl: null });
    assert.deepEqual(missingAfterSave(bare, nothingSent), { mustHave: ["poster"], goodToHave: ["cover"] });
    assert.deepEqual(missingAfterSave(bare, { posterFile: { name: "poster.jpg" } }), {
      mustHave: [],
      goodToHave: ["cover"],
    });
    assert.deepEqual(missingAfterSave(bare, { posterFile: {}, coverFile: {} }), NOTHING);
  });

  it("an episode is still asked for nothing", () => {
    assert.deepEqual(missingAfterSave(movie({ ...BARE, seriesId: "series-1" }), nothingSent), NOTHING);
  });
});

describe("createAnswerOrder — the newest answer about a movie stays", () => {
  it("two reads answered in the order they were sent: both are taken, the second stays", () => {
    const order = createAnswerOrder();
    const a = order.send();
    const b = order.send();
    assert.equal(order.accept("movie-1", a), true);
    assert.equal(order.accept("movie-1", b), true);
  });

  it("the older read landing after the newer one is dropped", () => {
    const order = createAnswerOrder();
    const a = order.send();
    const b = order.send();
    assert.equal(order.accept("movie-1", b), true);
    assert.equal(order.accept("movie-1", a), false);
  });

  it("the older read landing between the newer one being sent and answered does not make it be dropped", () => {
    const order = createAnswerOrder();
    const batch = order.send();
    const afterTmdb = order.send();
    assert.equal(order.accept("movie-1", batch), true);
    assert.equal(order.accept("movie-1", afterTmdb), true);
    // A third, older answer that turns up late changes nothing.
    assert.equal(order.accept("movie-1", batch), false);
  });

  it("what is known now (a Save's answer) wins over a read still on its way", () => {
    const order = createAnswerOrder();
    const read = order.send();
    assert.equal(order.accept("movie-1", order.send()), true);
    assert.equal(order.accept("movie-1", read), false);
  });

  it("one read answering for several movies is taken for each; movies do not block each other", () => {
    const order = createAnswerOrder();
    const batch = order.send();
    const one = order.send();
    assert.equal(order.accept("movie-2", one), true);
    assert.equal(order.accept("movie-1", batch), true);
    assert.equal(order.accept("movie-2", batch), false);
  });

  it("knows whether a movie was ever answered for", () => {
    const order = createAnswerOrder();
    assert.equal(order.has("movie-1"), false);
    order.accept("movie-1", order.send());
    assert.equal(order.has("movie-1"), true);
    assert.equal(order.has("movie-2"), false);
  });
});

describe("whether Publish asks first", () => {
  it("only when something in 'must have' is missing", () => {
    assert.equal(publishQuestionNeeded({ mustHave: ["poster"], goodToHave: [] }), true);
    assert.equal(publishQuestionNeeded({ mustHave: [], goodToHave: ["cover", "cast"] }), false);
    assert.equal(publishQuestionNeeded(NOTHING), false);
    assert.equal(publishQuestionNeeded(null), false);
    assert.equal(publishQuestionNeeded(undefined), false);
  });

  it("anythingMissing counts both lists", () => {
    assert.equal(anythingMissing({ mustHave: [], goodToHave: ["ageRating"] }), true);
    assert.equal(anythingMissing({ mustHave: ["categories"], goodToHave: [] }), true);
    assert.equal(anythingMissing(NOTHING), false);
    assert.equal(anythingMissing(null), false);
  });

  it("a Save publishes only when the Status field was changed to Published", () => {
    assert.equal(saveWillPublish("READY_TO_PUBLISH", "PUBLISHED"), true);
    assert.equal(saveWillPublish("DRAFT", "PUBLISHED"), true);
    assert.equal(saveWillPublish("PUBLISHED", "PUBLISHED"), false);
    assert.equal(saveWillPublish("READY_TO_PUBLISH", "READY_TO_PUBLISH"), false);
    assert.equal(saveWillPublish("PUBLISHED", "ARCHIVED"), false);
  });
});

describe("getFromTmdbOffered — the button beside the green badge", () => {
  const lacksPoster: MissingDetails = { mustHave: ["poster"], goodToHave: [] };

  it("a linked title with something missing, for staff who may act", () => {
    assert.equal(getFromTmdbOffered("MATCHED", lacksPoster, true), true);
    assert.equal(getFromTmdbOffered("MATCHED", { mustHave: [], goodToHave: ["cover"] }, true), true);
  });

  it("not when nothing is missing, when staff may not act, or when the title is not linked", () => {
    assert.equal(getFromTmdbOffered("MATCHED", NOTHING, true), false);
    assert.equal(getFromTmdbOffered("MATCHED", null, true), false);
    assert.equal(getFromTmdbOffered("MATCHED", lacksPoster, false), false);
    for (const status of ["NONE", "PENDING", "NEEDS_PICK", "NOT_FOUND", "FAILED"] as const) {
      assert.equal(getFromTmdbOffered(status, lacksPoster, true), false, status);
    }
    assert.equal(getFromTmdbOffered(undefined, lacksPoster, true), false);
  });
});

describe("sameMissingDetails — a card keeps the value it has", () => {
  it("equal lists are the same, whatever object carries them", () => {
    assert.equal(sameMissingDetails(missingMovieDetails(movie(BARE)), missingMovieDetails(movie(BARE))), true);
    assert.equal(sameMissingDetails(NOTHING, { mustHave: [], goodToHave: [] }), true);
    assert.equal(sameMissingDetails(null, undefined), true);
  });

  it("a different list, or known against not known, is not", () => {
    assert.equal(sameMissingDetails({ mustHave: ["poster"], goodToHave: [] }, NOTHING), false);
    assert.equal(sameMissingDetails({ mustHave: [], goodToHave: ["cover"] }, { mustHave: [], goodToHave: ["cast"] }), false);
    assert.equal(sameMissingDetails(NOTHING, null), false);
  });
});

describe("missingLineState — the three looks of the line", () => {
  it("needs: something in 'must have' is missing; the good-to-have list rides along", () => {
    assert.deepEqual(missingLineState({ mustHave: ["poster"], goodToHave: ["cover"] }), {
      look: "needs",
      mustHave: ["poster"],
      goodToHave: ["cover"],
    });
  });

  it("ready: nothing in 'must have' is missing, with or without good-to-have things", () => {
    assert.deepEqual(missingLineState(NOTHING), { look: "ready", mustHave: [], goodToHave: [] });
    assert.deepEqual(missingLineState({ mustHave: [], goodToHave: ["ageRating"] }), {
      look: "ready",
      mustHave: [],
      goodToHave: ["ageRating"],
    });
  });

  it("pending: while TMDB is looking the lists are not shown at all", () => {
    const pending = { look: "pending", mustHave: [], goodToHave: [] };
    assert.deepEqual(missingLineState(missingMovieDetails(movie(BARE)), true), pending);
    assert.deepEqual(missingLineState(NOTHING, true), pending);
    assert.deepEqual(missingLineState(null, true), pending);
  });

  it("no line when the details are not known, or for an episode", () => {
    assert.equal(missingLineState(null), null);
    assert.equal(missingLineState(undefined), null);
    assert.equal(missingLineState(missingMovieDetailsOrNull(movie({ seriesId: "series-1" }))), null);
  });
});

describe("the words — names and lists", () => {
  it("the seven short names, in English", () => {
    assert.deepEqual(
      [...MUST_HAVE_KEYS, ...GOOD_TO_HAVE_KEYS].map((key) => missingKeyLabel(en, key)),
      ["Poster", "Description", "Category", "Banner", "Actors", "Director", "Age rating"],
    );
  });

  it("the Burmese names are the ones the TMDB review already uses for the same things", () => {
    const fields = mm.tmdb.review.fields;
    for (const key of [...MUST_HAVE_KEYS, ...GOOD_TO_HAVE_KEYS]) {
      assert.equal(missingKeyLabel(mm, key), fields[key], key);
    }
    // "Category" is not the word of the "Type" row (Korean movie…): staff
    // sent to the review by the line must find the row with the same name.
    assert.notEqual(missingKeyLabel(mm, "categories"), fields.country);
  });

  it("a picture's field label is the name the line uses for it", () => {
    for (const t of [en, mm]) {
      assert.equal(t.movies.editDialog.posterLabel, missingKeyLabel(t, "poster"));
      assert.equal(t.movies.editDialog.bannerLabel, missingKeyLabel(t, "cover"));
      assert.equal(t.series.manage.bannerLabel, missingKeyLabel(t, "cover"));
      // The series card's first picture is labelled with the movie's
      // "Poster" word. Its own old word ("Thumbnail") is gone from the
      // file, so the field cannot be given that name again: tsc refuses it.
      assert.equal("thumbnailLabel" in t.series.manage, false);
    }
  });

  it("a list is joined with a middle dot, in the order given", () => {
    assert.equal(MISSING_LIST_SEPARATOR, " · ");
    assert.equal(missingListText(en, ["poster", "description", "categories"]), "Poster · Description · Category");
    assert.equal(missingListText(en, ["cover"]), "Banner");
    assert.equal(missingListText(en, []), "");
    assert.equal(missingListText(mm, ["poster", "cover"]), "ပိုစတာ · ဘန်နာ");
  });
});

describe("missingLineWords — what the line says", () => {
  it("amber: 'Still needed: …' and the grey 'Good to have: …' under it", () => {
    assert.deepEqual(missingLineWords(en, missingMovieDetails(movie(BARE))), {
      look: "needs",
      main: "Still needed: Poster · Description · Category",
      goodToHave: "Good to have: Banner · Actors · Director · Age rating",
    });
    assert.deepEqual(missingLineWords(en, { mustHave: ["poster"], goodToHave: [] }), {
      look: "needs",
      main: "Still needed: Poster",
      goodToHave: null,
    });
  });

  it("green: 'Ready', with the grey line when something is good to have", () => {
    assert.deepEqual(missingLineWords(en, NOTHING), { look: "ready", main: "Ready", goodToHave: null });
    assert.deepEqual(missingLineWords(en, { mustHave: [], goodToHave: ["ageRating"] }), {
      look: "ready",
      main: "Ready",
      goodToHave: "Good to have: Age rating",
    });
  });

  it("grey and nothing else while TMDB is still looking", () => {
    assert.deepEqual(missingLineWords(en, missingMovieDetails(movie(BARE)), true), {
      look: "pending",
      main: "The list appears when TMDB has finished.",
      goodToHave: null,
    });
  });

  it("nothing for an episode or an unknown title", () => {
    assert.equal(missingLineWords(en, null), null);
    assert.equal(missingLineWords(en, undefined), null);
  });

  it("in Burmese too", () => {
    assert.deepEqual(missingLineWords(mm, { mustHave: ["poster"], goodToHave: ["cover"] }), {
      look: "needs",
      main: mm.movies.missing.stillNeeded("ပိုစတာ"),
      goodToHave: mm.movies.missing.goodToHave("ဘန်နာ"),
    });
    assert.equal(missingLineWords(mm, NOTHING)?.main, mm.movies.missing.ready);
    assert.notEqual(mm.movies.missing.ready, en.movies.missing.ready);
  });
});

describe("missingBoxWords — the top of Edit movie and of Series information", () => {
  it("the amber box: what is needed, then good to have and 'the list gets shorter'", () => {
    assert.deepEqual(missingBoxWords(en, { mustHave: ["poster"], goodToHave: ["cover"] }), {
      look: "needs",
      main: "Still needed before publishing: Poster",
      second: "Good to have: Banner. The list gets shorter as you fill things in.",
    });
  });

  it("with nothing good to have, the second line is only 'the list gets shorter'", () => {
    assert.deepEqual(missingBoxWords(en, { mustHave: ["poster", "categories"], goodToHave: [] }), {
      look: "needs",
      main: "Still needed before publishing: Poster · Category",
      second: "The list gets shorter as you fill things in.",
    });
  });

  it("where the list follows the stored title, 'gets shorter' is left out", () => {
    assert.equal(
      missingBoxWords(en, { mustHave: ["poster"], goodToHave: ["cover", "cast"] }, false)?.second,
      "Good to have: Banner · Actors",
    );
    assert.equal(missingBoxWords(en, { mustHave: ["poster"], goodToHave: [] }, false)?.second, null);
  });

  it("only good-to-have things missing: one quiet line, no box", () => {
    assert.deepEqual(missingBoxWords(en, { mustHave: [], goodToHave: ["cover", "ageRating"] }), {
      look: "goodOnly",
      main: "Good to have: Banner · Age rating",
      second: null,
    });
  });

  it("a title that is live already is not told 'before publishing'; the rest is the same", () => {
    assert.deepEqual(missingBoxWords(en, { mustHave: ["poster"], goodToHave: ["cover"] }, true, true), {
      look: "needs",
      main: en.movies.missing.stillNeeded("Poster"),
      second: "Good to have: Banner. The list gets shorter as you fill things in.",
    });
    assert.equal(
      missingBoxWords(en, { mustHave: ["poster", "categories"], goodToHave: [] }, true, true)?.main,
      "Still needed: Poster · Category",
    );
    assert.equal(
      missingBoxWords(mm, { mustHave: ["poster"], goodToHave: [] }, true, true)?.main,
      mm.movies.missing.stillNeeded(missingKeyLabel(mm, "poster")),
    );
    // The quiet line and "nothing" do not speak of publishing: no change.
    const goodOnly: MissingDetails = { mustHave: [], goodToHave: ["cover", "ageRating"] };
    assert.deepEqual(missingBoxWords(en, goodOnly, true, true), missingBoxWords(en, goodOnly));
    assert.equal(missingBoxWords(en, NOTHING, true, true), null);
    assert.equal(missingBoxWords(en, null, true, true), null);
  });

  it("nothing missing, or an episode: nothing", () => {
    assert.equal(missingBoxWords(en, NOTHING), null);
    assert.equal(missingBoxWords(en, null), null);
    assert.equal(missingBoxWords(en, missingFormDetails("episode", EMPTY_FORM)), null);
  });

  it("the Burmese second line ends its first sentence the Burmese way", () => {
    const second = missingBoxWords(mm, { mustHave: ["poster"], goodToHave: ["cover"] })?.second ?? "";
    assert.equal(second, mm.movies.missing.goodToHaveThenShorter("ဘန်နာ"));
    assert.ok(second.includes("ဘန်နာ။"));
    assert.ok(second.endsWith(mm.movies.missing.listGetsShorter));
  });
});

describe("publishQuestionWords — the question Publish asks", () => {
  it("one thing missing names it in the title", () => {
    assert.deepEqual(
      publishQuestionWords(en, "movie", "Deadpool & Wolverine", { mustHave: ["poster"], goodToHave: ["cover"] }),
      {
        title: "Publish without a poster?",
        description:
          "“Deadpool & Wolverine” still needs: Poster. Viewers will see the movie without it. You can go back and add it first.",
        confirmLabel: "Publish anyway",
        cancelLabel: "Go back",
      },
    );
    assert.equal(
      publishQuestionWords(en, "movie", "X", { mustHave: ["description"], goodToHave: [] })?.title,
      "Publish without a description?",
    );
    assert.equal(
      publishQuestionWords(en, "movie", "X", { mustHave: ["categories"], goodToHave: [] })?.title,
      "Publish without a category?",
    );
  });

  it("several things missing: 'details missing', and 'them'", () => {
    assert.deepEqual(publishQuestionWords(en, "movie", "Shwe Kyar 2024", missingMovieDetails(movie(BARE))), {
      title: "Publish with details missing?",
      description:
        "“Shwe Kyar 2024” still needs: Poster · Description · Category. Viewers will see the movie without them. You can go back and add them first.",
      confirmLabel: "Publish anyway",
      cancelLabel: "Go back",
    });
  });

  it("good-to-have things are never named in the question", () => {
    const words = publishQuestionWords(en, "movie", "X", { mustHave: ["poster"], goodToHave: ["cover", "cast"] });
    assert.ok(!words?.description.includes("Banner"));
    assert.ok(!words?.description.includes("Actors"));
  });

  it("a series is called the series", () => {
    assert.equal(
      publishQuestionWords(en, "series", "Squid Game", { mustHave: ["poster"], goodToHave: [] })?.description,
      "“Squid Game” still needs: Poster. Viewers will see the series without it. You can go back and add it first.",
    );
    assert.equal(
      publishQuestionWords(en, "series", "Squid Game", { mustHave: ["poster", "categories"], goodToHave: [] })
        ?.description,
      "“Squid Game” still needs: Poster · Category. Viewers will see the series without them. You can go back and add them first.",
    );
  });

  it("no question when nothing in 'must have' is missing: Publish goes straight through", () => {
    assert.equal(publishQuestionWords(en, "movie", "Inception", NOTHING), null);
    assert.equal(publishQuestionWords(en, "movie", "Inception", { mustHave: [], goodToHave: ["cover"] }), null);
    assert.equal(publishQuestionWords(en, "movie", "Inception", null), null);
    const episode = movie({ ...BARE, seriesId: "series-1" });
    assert.equal(publishQuestionWords(en, "movie", episode.title, missingMovieDetails(episode)), null);
  });

  it("in Burmese: its own titles, the title in the body, the list in Burmese", () => {
    const one = publishQuestionWords(mm, "movie", "Shwe Kyar 2024", { mustHave: ["poster"], goodToHave: [] });
    assert.equal(one?.title, mm.movies.missing.questionTitleOne.poster);
    assert.equal(one?.description, mm.movies.missing.questionBodyMovieOne("Shwe Kyar 2024", "ပိုစတာ"));
    assert.ok(one?.description.includes("“Shwe Kyar 2024”"));
    assert.equal(one?.confirmLabel, mm.movies.missing.publishAnyway);
    assert.equal(one?.cancelLabel, mm.movies.missing.goBack);
    assert.ok(mm.movies.missing.questionTitleOne.categories.startsWith(missingKeyLabel(mm, "categories")));
    const several = publishQuestionWords(mm, "series", "Squid Game", {
      mustHave: ["poster", "categories"],
      goodToHave: [],
    });
    assert.equal(several?.title, mm.movies.missing.questionTitleSeveral);
    assert.equal(
      several?.description,
      mm.movies.missing.questionBodySeriesSeveral("Squid Game", "ပိုစတာ · အမျိုးအစားများ"),
    );
  });
});

describe("seriesPublishDescription — the 'Publish this series?' dialog", () => {
  it("gets one more sentence when something in 'must have' is missing", () => {
    assert.equal(
      seriesPublishDescription(en, "Squid Game", { mustHave: ["poster", "categories"], goodToHave: ["cover"] }),
      `${en.series.publishConfirmDescription("Squid Game")} Still needed: Poster · Category.`,
    );
  });

  it("is exactly the sentence it always was when nothing is", () => {
    const before = en.series.publishConfirmDescription("Squid Game");
    assert.equal(seriesPublishDescription(en, "Squid Game", NOTHING), before);
    assert.equal(seriesPublishDescription(en, "Squid Game", { mustHave: [], goodToHave: ["cover", "cast"] }), before);
    assert.equal(seriesPublishDescription(en, "Squid Game", null), before);
  });
});

describe("the sentence under Ready to publish", () => {
  it("says that Publish asks first", () => {
    assert.equal(
      en.tmdbPages.readyToPublish.publishNeverBlocked,
      "Publish is never blocked. If something is still needed, Publish asks you first.",
    );
    assert.notEqual(mm.tmdbPages.readyToPublish.publishNeverBlocked, en.tmdbPages.readyToPublish.publishNeverBlocked);
  });
});
