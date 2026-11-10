"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Rocket } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUploadField, type FileUploadEmptyState } from "./FileUploadField";
import { MissingDetailsBox } from "./MissingDetailsLine";
import {
  missingAfterSave,
  missingFormDetails,
  missingMovieDetails,
  publishQuestionWords,
  saveWillPublish,
  type PublishQuestionWords,
} from "./missingDetails";
import { ActorPicker } from "@/components/actors/ActorPicker";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  DESCRIPTION_MAX_LENGTH,
  DescriptionLanguageSection,
  descriptionProblem,
  isDescriptionRequiredError,
} from "@/components/shared/DescriptionLanguageSection";
import { ErrorState } from "@/components/shared/ErrorState";
import { MediaTypeSelect } from "@/components/shared/MediaTypeSelect";
import { TmdbTaggedField } from "@/components/tmdb/TmdbFromTag";
import { TmdbMatchDialog, tmdbTargetOfMovie } from "@/components/tmdb/TmdbMatchDialog";
import { TmdbStrip } from "@/components/tmdb/TmdbStrip";
import { tmdbStatesUse } from "@/components/tmdb/tmdbPolling";
import { pictureTagShown, tmdbActionOpensDialog, type TmdbAction } from "@/components/tmdb/tmdbStatus";
import { tmdbErrorCode, tmdbErrorMessage } from "@/components/tmdb/tmdbWords";
import { movieService } from "@/services/api/movieService";
import { tmdbService } from "@/services/api/tmdbService";
import { videoService } from "@/services/api/videoService";
import { uploadService } from "@/services/api/uploadService";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useObjectUrl } from "@/lib/hooks/use-object-url";
import { useTmdbConnection, useTmdbStates } from "@/lib/hooks/use-tmdb-states";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import {
  AGE_RATING_LABELS,
  AGE_RATINGS,
  GENRE_OPTIONS,
  LANGUAGES,
  type AgeRating,
} from "@/lib/constants/movie-options";
import { parseRatingInput, ratingToInput } from "@/lib/rating";
import { buildMovieUpdate, hasChanges, rebaseIds, type MovieFormSnapshot } from "@/lib/upload/changed-fields";
import { SubtitleManager } from "./SubtitleManager";
import { VideoSection } from "./VideoSection";
import type { Movie, MovieCategory } from "@/types/movie";
import type { TmdbMovieState } from "@/types/tmdb";
import { toast } from "sonner";

/**
 * What a page hands the dialog to open it for a title. The dialog loads the
 * movie itself, so the id is all it needs; the title names the dialog until
 * the movie has arrived. A whole `Movie` row fits as it is.
 */
export type EditMovieTarget = Pick<Movie, "id" | "title">;

/** The Select value that stands for "no age rating" — the form then sends null, which the backend stores as "not set". */
const AGE_NOT_SET = "__none__";

/** The TMDB strip above the fields, as the form needs it. The session owns the state and what a press does. */
interface EditMovieTmdb {
  /** Null while there is nothing read yet. While TMDB is not connected it is read all the same, for the folder name. */
  state: TmdbMovieState | null;
  /** The server has no TMDB key: the strip says so and shows no buttons. */
  notConnected: boolean;
  /** MOVIES.EDIT + MEDIA.UPLOAD. */
  canAct: boolean;
  /** A lookup request is on its way. */
  busy: boolean;
  /** The lookup is still running after 3 minutes: the strip offers Try again. */
  timedOut: boolean;
  onAction: (action: TmdbAction) => void;
}

interface EditMovieFormProps {
  /** The movie as the dialog loaded it: what the fields start from, and what Save is compared with. */
  movie: Movie;
  /** Every category, for the chips; null while they load. */
  categories: MovieCategory[] | null;
  /** Null = no strip: an episode (episodes are not looked up), or nothing to show. */
  tmdb: EditMovieTmdb | null;
  /**
   * Details from TMDB were stored while this form held unsaved changes, so
   * the form does not show them: `movie` is behind the server until the
   * form is loaded again. What is still needed is then not what the form
   * says, and a publish asks the server first.
   */
  behindServer: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (movie: Movie) => void;
  /** Publish was pressed inside the dialog and went through. */
  onPublished: (movie: Movie) => void;
  /** Tells the session whether the form holds unsaved changes, so a reload never wipes them. */
  onUnsavedChange: (unsaved: boolean) => void;
}

function EditMovieForm({
  movie,
  categories,
  tmdb,
  behindServer,
  onOpenChange,
  onSaved,
  onPublished,
  onUnsavedChange,
}: EditMovieFormProps) {
  const { t } = useLanguage();
  const [title, setTitle] = useState(movie.title);
  const [description, setDescription] = useState(movie.description ?? "");
  // `?? ""`: a backend from before the Burmese description leaves the field out.
  const [descriptionMm, setDescriptionMm] = useState(movie.descriptionMm ?? "");
  const [genre, setGenre] = useState(movie.genre);
  const [language, setLanguage] = useState(movie.language);
  const [director, setDirector] = useState(movie.director ?? "");
  const [ageRating, setAgeRating] = useState<AgeRating | null>(movie.ageRating ?? null);
  const [country, setCountry] = useState<string | null>(movie.country);
  const [categoryIds, setCategoryIds] = useState<string[]>(movie.categories.map((c) => c.id));
  const [actorIds, setActorIds] = useState<string[]>(movie.actors.map((a) => a.id));
  const [releaseYear, setReleaseYear] = useState(String(movie.releaseYear));
  // 0 is the API's "never measured" sentinel, so it shows as an empty field
  // rather than a literal 0 the admin would have to notice and delete.
  const [duration, setDuration] = useState(movie.duration > 0 ? String(movie.duration) : "");
  const [rating, setRating] = useState(ratingToInput(movie.rating));
  const [accessType, setAccessType] = useState<Movie["accessType"]>(movie.accessType);
  const [status, setStatus] = useState<Movie["status"]>(movie.status);
  const isEpisode = movie.seriesId !== null;
  const [seasonNumber, setSeasonNumber] = useState(String(movie.seasonNumber ?? 1));
  const [episodeNumber, setEpisodeNumber] = useState(String(movie.episodeNumber ?? 1));
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // A video replace in flight locks the footer: saving would race the swap's
  // own Movie.duration refresh, and closing would abort the upload.
  const [replacingVideo, setReplacingVideo] = useState(false);

  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const posterPreview = useObjectUrl(posterFile);
  const coverPreview = useObjectUrl(coverFile);
  const thumbnailPreview = useObjectUrl(thumbnailFile);

  // What the movie still needs before it is published (missingDetails.ts),
  // by what the form holds NOW — which is what Save stores — so the list at
  // the top gets shorter as staff type and pick files. An episode needs
  // nothing: it uses the show's pictures.
  const missing = isEpisode
    ? null
    : missingFormDetails("movie", {
        posterUrl: movie.posterUrl,
        posterFile,
        coverUrl: movie.coverUrl,
        coverFile,
        description,
        descriptionMm,
        categoryIds,
        actorIds,
        director,
        ageRating,
      });
  // Publish asks first while a poster, a description or a category is
  // missing; it is never blocked. The dialog has two ways to publish — its
  // Publish button, and Save with the Status field moved to Published — so
  // the question remembers which one waits for the answer. Its words stay
  // while it closes; only `publishQuestionOpen` goes.
  const [publishQuestion, setPublishQuestion] = useState<{
    via: "publish" | "save";
    words: PublishQuestionWords;
  } | null>(null);
  const [publishQuestionOpen, setPublishQuestionOpen] = useState(false);

  // A video only exists once something has actually been uploaded for this
  // movie — getProcessingStatus() 404s otherwise, which useAsyncData already
  // turns into a normal `error` we can just check for instead of throwing.
  const {
    data: videoStatus,
    error: videoError,
    refetch: refetchVideoStatus,
  } = useAsyncData(() => videoService.getProcessingStatus(movie.id), [movie.id]);

  // Empty is a value (0 = unrated); null means the text is not a rating at all.
  const ratingValue = parseRatingInput(rating);

  /**
   * What the form holds now, parsed, for `buildMovieUpdate` to compare with
   * the loaded movie. A field this title does not show is left out, so it
   * can never be sent: an episode has no type, language, director, age
   * rating or rating of its own (the show's are shown), a movie no episode
   * position. `pictures` are the URLs of the files uploaded for this save.
   */
  const snapshot = (
    pictures: Pick<MovieFormSnapshot, "posterUrl" | "coverUrl" | "thumbnailUrl"> = {},
  ): MovieFormSnapshot => ({
    title,
    description,
    descriptionMm,
    genre,
    releaseYear: Number(releaseYear),
    // Below 1 is "not entered": the API rejects 0, so clearing the field
    // leaves the stored runtime untouched instead of zeroing it.
    duration: Math.round(Number(duration)),
    accessType,
    status,
    categoryIds,
    actorIds,
    ...pictures,
    ...(isEpisode
      ? {
          seasonNumber: Math.max(1, Number(seasonNumber) || 1),
          episodeNumber: Math.max(1, Number(episodeNumber) || 1),
        }
      : {
          language,
          director,
          ageRating,
          country,
          ...(ratingValue !== null ? { rating: ratingValue } : {}),
        }),
  });

  const filePicked = posterFile !== null || coverFile !== null || thumbnailFile !== null;
  // Unsaved = Save would send something. The TMDB buttons wait for it: a
  // fill is reviewed against what is stored, not against what is typed.
  const unsaved = filePicked || ratingValue === null || hasChanges(buildMovieUpdate(movie, snapshot()));
  useEffect(() => {
    onUnsavedChange(unsaved);
    return () => onUnsavedChange(false);
  }, [unsaved, onUnsavedChange]);

  // The movie as the server has it now, for a publish from a form that is
  // behind it. Null when the read fails: the caller judges as usual.
  const readStored = () => movieService.getMovieById(movie.id).catch(() => null);

  /** `publishConfirmed`: "Publish anyway" was pressed on the question this save asked. */
  const handleSave = async (publishConfirmed = false) => {
    // Unlike duration, an empty rating IS a value (0 = unrated), so only a
    // malformed one blocks the save.
    if (ratingValue === null) {
      toast.error(t.movies.editDialog.ratingInvalidToast);
      return;
    }
    if (descriptionProblem(description, descriptionMm) === "too_long") {
      toast.error(t.tmdbPages.editMovie.descriptionTooLong(DESCRIPTION_MAX_LENGTH));
      return;
    }
    const typed = buildMovieUpdate(movie, snapshot());
    // One language is enough, but the API refuses a save that blanks the
    // last description a title has. A title that never had one (a fresh
    // upload) saves everything else as before.
    if (
      (typed.description !== undefined || typed.descriptionMm !== undefined) &&
      !description.trim() &&
      !descriptionMm.trim()
    ) {
      toast.error(t.tmdbPages.series.descriptionRequired);
      return;
    }
    // Nothing changed: close without a request.
    if (!filePicked && !hasChanges(typed)) {
      onOpenChange(false);
      return;
    }
    // The Status field was moved to Published, so this save is what
    // publishes: it asks first, like Publish, when something is still
    // needed — judged by what the form holds, which is what the save
    // stores. "Go back" only closes the question: nothing is sent and the
    // form keeps everything.
    if (!publishConfirmed && saveWillPublish(movie.status, status)) {
      let judged = missing;
      let judgedTitle = title.trim();
      if (behindServer) {
        // Not so while the form is behind the server: the save sends only
        // what staff changed, so the name, the poster and the categories
        // TMDB stored meanwhile stay. One read says what the movie holds
        // after this save; if it fails, the form is judged as usual.
        setSaving(true);
        const fresh = await readStored();
        if (fresh) {
          judgedTitle = typed.title ?? fresh.title;
          judged = missingAfterSave(fresh, {
            description: typed.description,
            descriptionMm: typed.descriptionMm,
            director: typed.director,
            ageRating: typed.ageRating,
            categoryIds:
              typed.categoryIds &&
              rebaseIds(
                movie.categories.map((c) => c.id),
                typed.categoryIds,
                fresh.categories.map((c) => c.id),
              ),
            actorIds:
              typed.actorIds &&
              rebaseIds(
                movie.actors.map((a) => a.id),
                typed.actorIds,
                fresh.actors.map((a) => a.id),
              ),
            posterFile,
            coverFile,
          });
        }
      }
      const words = publishQuestionWords(t, "movie", judgedTitle, judged);
      if (words) {
        setSaving(false);
        setPublishQuestion({ via: "save", words });
        setPublishQuestionOpen(true);
        return;
      }
    }
    setSaving(true);
    try {
      const [posterUrl, coverUrl, thumbnailUrl] = await Promise.all([
        posterFile ? uploadService.uploadImage(posterFile, "movie").then((r) => r.url) : undefined,
        coverFile ? uploadService.uploadImage(coverFile, "movie").then((r) => r.url) : undefined,
        thumbnailFile ? uploadService.uploadImage(thumbnailFile, "movie").then((r) => r.url) : undefined,
      ]);

      // Only what staff changed goes out. Details can change on the server
      // while this dialog is open — a TMDB fill adds a cast and a poster, a
      // finished upload moves the status on — and echoing the whole record
      // back would undo that (lib/upload/changed-fields.ts).
      const payload = buildMovieUpdate(movie, snapshot({ posterUrl, coverUrl, thumbnailUrl }));
      // The two lists are the exception: the API `set`s them, so a changed
      // one goes out whole. It is rebuilt on the movie as it is stored at
      // this moment — a fill that landed since the form was loaded (the
      // dialog opened while the folder still uploaded) keeps its cast and
      // its categories, and staff's own additions and removals go on top.
      if (payload.categoryIds || payload.actorIds) {
        const fresh = await movieService.getMovieById(movie.id);
        if (payload.categoryIds) {
          payload.categoryIds = rebaseIds(
            movie.categories.map((c) => c.id),
            payload.categoryIds,
            fresh.categories.map((c) => c.id),
          );
        }
        if (payload.actorIds) {
          payload.actorIds = rebaseIds(
            movie.actors.map((a) => a.id),
            payload.actorIds,
            fresh.actors.map((a) => a.id),
          );
        }
      }
      const updated = await movieService.updateMovie(movie.id, payload);
      onSaved(updated);
      toast.success(t.movies.editDialog.updatedToast, {
        description: t.movies.editDialog.updatedDescription(updated.title),
      });
      onOpenChange(false);
    } catch (err) {
      // The check above passed against the movie as it was loaded; the
      // server refuses against the movie as it is now.
      if (isDescriptionRequiredError(err)) toast.error(t.tmdbPages.series.descriptionRequired);
      else toast.error(t.movies.editDialog.saveFailedToast, { description: t.movies.pleaseTryAgain });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const updated = await movieService.updateMovie(movie.id, { status: "PUBLISHED" });
      setStatus("PUBLISHED");
      onPublished(updated);
      toast.success(t.movies.publishedToast, { description: t.movies.publishedDescription(movie.title) });
    } catch {
      toast.error(t.movies.publishFailedToast, { description: t.movies.pleaseTryAgain });
    } finally {
      setPublishing(false);
    }
  };

  // The Publish button only sends the status, so it is judged by the movie
  // as it is STORED: a poster picked here and not saved yet is not published
  // with it. Nothing needed (and every episode): straight through, as before.
  // `movie` is the stored movie as this form was loaded — except while the
  // form is behind the server, when it is read once more first.
  const handlePublishPress = async () => {
    let stored = movie;
    if (behindServer) {
      setPublishing(true);
      stored = (await readStored()) ?? movie;
    }
    const words = publishQuestionWords(t, "movie", stored.title, missingMovieDetails(stored));
    if (!words) {
      void handlePublish();
      return;
    }
    setPublishing(false);
    setPublishQuestion({ via: "publish", words });
    setPublishQuestionOpen(true);
  };

  // "Publish anyway": what was asked about goes on exactly as it would have.
  // The question takes a moment to fade: a second press in that moment must
  // not publish (or save) twice.
  const handlePublishAnyway = () => {
    if (!publishQuestionOpen) return;
    setPublishQuestionOpen(false);
    if (publishQuestion?.via === "publish") void handlePublish();
    else if (publishQuestion?.via === "save") void handleSave(true);
  };

  // A word outside the list (an older title, or one typed elsewhere) stays
  // choosable, so opening the dialog never loses it.
  const languageOptions =
    movie.language && !LANGUAGES.includes(movie.language) ? [...LANGUAGES, movie.language] : LANGUAGES;
  // `items` lets the closed trigger show "PG-13", not the stored "PG13".
  const ageRatingItems: Record<string, string> = { [AGE_NOT_SET]: t.tmdbPages.editMovie.ageRatingNotSet };
  for (const value of AGE_RATINGS) ageRatingItems[value] = AGE_RATING_LABELS[value];

  // The "From TMDB" marks only say where a value came from: a picked file,
  // or a letter typed in the English box, makes its mark go. A picture's
  // mark also needs the picture: the state can be newer than this form.
  const posterFromTmdb = pictureTagShown(tmdb?.state?.images.poster, movie.posterUrl, posterFile !== null);
  const coverFromTmdb = pictureTagShown(tmdb?.state?.images.cover, movie.coverUrl, coverFile !== null);
  const englishFromTmdb =
    (tmdb?.state?.autoFields.includes("description") ?? false) && description === movie.description;

  // What an empty poster or banner slot says (movies only). "Refill" is
  // named only while the strip above really has that button. Behind the
  // server an empty slot proves nothing — TMDB's picture may be stored by
  // now — so it is the plain "Click to upload" again.
  const refillOffered =
    tmdb !== null && !tmdb.notConnected && tmdb.canAct && tmdb.state?.status === "MATCHED";
  const slotsSayMissing = !isEpisode && !behindServer;
  const posterEmptyState: FileUploadEmptyState | undefined = slotsSayMissing
    ? {
        title: t.movies.missing.posterNeeded,
        hint: refillOffered ? t.movies.missing.uploadOneOrRefill : t.movies.missing.uploadOne,
        tone: "warning",
      }
    : undefined;
  const coverEmptyState: FileUploadEmptyState | undefined = slotsSayMissing
    ? { title: t.movies.missing.noBannerYet, hint: t.movies.missing.goodToHaveShort }
    : undefined;

  return (
    <>
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
        {/* What is still needed before publishing, above everything else
            (the `MissingEdit` board). It draws nothing for an episode, and
            nothing once nothing is missing. A movie that is live already
            (as stored, not the Status field) is not told "before
            publishing". */}
        {behindServer ? (
          // The form does not show what TMDB has just stored, so a list
          // made from it would name things the movie has by now. It says
          // what the toast said, until the form is loaded again.
          <div className="flex flex-col gap-0.5 text-[13px] text-muted-foreground" role="status">
            <p className="font-medium text-foreground/80">{t.tmdbPages.editMovie.detailsArrivedToast}</p>
            <p>{t.tmdbPages.editMovie.detailsArrivedUnsavedHint}</p>
          </div>
        ) : (
          <MissingDetailsBox missing={missing} published={movie.status === "PUBLISHED"} />
        )}

        {tmdb && (
          <TmdbStrip
            state={tmdb.state}
            notConnected={tmdb.notConnected}
            unsaved={unsaved}
            // No TMDB buttons while a publish or a video replace is under
            // way: a fill would re-seed the form in the middle of it.
            canAct={tmdb.canAct && !publishing && !replacingVideo}
            busy={tmdb.busy}
            timedOut={tmdb.timedOut}
            onAction={tmdb.onAction}
          />
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-title">{t.tmdbPages.editMovie.nameLabel}</Label>
          <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        {isEpisode && (
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-secondary/20 p-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-season">{t.movies.editDialog.seasonLabel}</Label>
              <Input
                id="edit-season"
                type="number"
                min="1"
                value={seasonNumber}
                onChange={(e) => setSeasonNumber(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-episode">{t.movies.editDialog.episodeLabel}</Label>
              <Input
                id="edit-episode"
                type="number"
                min="1"
                value={episodeNumber}
                onChange={(e) => setEpisodeNumber(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* English is what TMDB fills; Burmese is typed by hand, at any time.
            Episodes get both boxes too — an episode is a movie row. */}
        <DescriptionLanguageSection
          idPrefix="edit-movie"
          english={description}
          burmese={descriptionMm}
          onEnglishChange={setDescription}
          onBurmeseChange={setDescriptionMm}
          englishFromTmdb={englishFromTmdb}
          disabled={saving}
        />

        {/* Two columns: with the rating a movie has four fields here, an episode three. */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t.movies.editDialog.genreLabel}</Label>
            <Select value={genre} onValueChange={(v) => v && setGenre(v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t.movies.editDialog.genrePlaceholder} /></SelectTrigger>
              <SelectContent>
                {GENRE_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-release-year">{t.movies.editDialog.releaseYearLabel}</Label>
            <Input
              id="edit-release-year"
              type="number"
              value={releaseYear}
              onChange={(e) => setReleaseYear(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-duration">{t.movies.editDialog.durationLabel}</Label>
            <Input
              id="edit-duration"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
            {movie.duration === 0 && duration === "" && (
              <p className="text-xs text-muted-foreground">{t.movies.editDialog.durationUnknownHint}</p>
            )}
          </div>
          {!isEpisode && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-rating">{t.movies.editDialog.ratingLabel}</Label>
              <Input
                id="edit-rating"
                type="number"
                min="0"
                max="10"
                step="0.1"
                inputMode="decimal"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
              />
              {/* Only while empty, the way the duration hint works, so the two cells stay even. */}
              {rating === "" && (
                <p className="text-xs text-muted-foreground">{t.movies.editDialog.ratingHint}</p>
              )}
            </div>
          )}
        </div>

        {/* Movies only: TMDB fills these three, so staff need a place to see
            and correct them. An episode follows its show. */}
        {!isEpisode && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t.tmdbPages.editMovie.languageLabel}</Label>
              <Select value={language} onValueChange={(v) => v && setLanguage(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t.tmdbPages.editMovie.languagePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-director">{t.tmdbPages.editMovie.directorLabel}</Label>
              <Input
                id="edit-director"
                value={director}
                maxLength={120}
                placeholder={t.tmdbPages.editMovie.directorPlaceholder}
                onChange={(e) => setDirector(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t.tmdbPages.editMovie.ageRatingLabel}</Label>
              <Select
                items={ageRatingItems}
                value={ageRating ?? AGE_NOT_SET}
                onValueChange={(v) => v && setAgeRating(v === AGE_NOT_SET ? null : (v as AgeRating))}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ageRatingItems).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {!isEpisode && <MediaTypeSelect kind="movie" value={country} onChange={setCountry} disabled={saving} />}
        <div className="flex flex-col gap-1.5">
          <Label>{t.movies.editDialog.categoriesLabel}</Label>
          <div className="flex flex-wrap gap-2">
            {categories?.map((c) => {
              const active = categoryIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    setCategoryIds((prev) => (active ? prev.filter((id) => id !== c.id) : [...prev, c.id]))
                  }
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-secondary/50"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
        <ActorPicker value={actorIds} onChange={setActorIds} disabled={saving} />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t.movies.editDialog.accessTypeLabel}</Label>
            <Select value={accessType} onValueChange={(v) => v && setAccessType(v as Movie["accessType"])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FREE">{t.movies.accessType.free}</SelectItem>
                <SelectItem value="SUBSCRIPTION">{t.movies.accessType.subscription}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t.movies.editDialog.statusLabel}</Label>
            <Select value={status} onValueChange={(v) => v && setStatus(v as Movie["status"])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PUBLISHED">{t.movies.status.published}</SelectItem>
                <SelectItem value="READY_TO_PUBLISH">{t.movies.status.readyToPublish}</SelectItem>
                <SelectItem value="UPLOADING">{t.movies.status.uploading}</SelectItem>
                <SelectItem value="PROCESSING">{t.movies.status.processing}</SelectItem>
                <SelectItem value="FAILED">{t.movies.status.failed}</SelectItem>
                <SelectItem value="DRAFT">{t.movies.status.draft}</SelectItem>
                <SelectItem value="ARCHIVED">{t.movies.status.archived}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{t.movies.video.title}</Label>
          <VideoSection
            movie={movie}
            videoStatus={videoError ? null : videoStatus}
            videoError={videoError}
            onVideoChanged={refetchVideoStatus}
            onReplacingChange={setReplacingVideo}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{t.movies.editDialog.imagesLabel}</Label>
          {/* Subtitles sit above the artwork on purpose: the poster fields are tall and
              used to push this list below the fold, so an editor who had just uploaded
              a track could not find it. */}
          {/* Keyed on the row's updatedAt as well as its id: a video replace keeps the
              same Video id but recreates every Subtitle row, and the manager only
              refetches when its videoId changes — the remount is what refreshes it. */}
          {!videoError && videoStatus && (
            <SubtitleManager key={`${videoStatus.id}:${videoStatus.updatedAt}`} videoId={videoStatus.id} />
          )}

          <div className="grid grid-cols-3 gap-4">
            <TmdbTaggedField fromTmdb={posterFromTmdb}>
              <FileUploadField
                label={t.movies.editDialog.posterLabel}
                accept="image/*"
                variant="image"
                aspect="poster"
                file={posterFile}
                previewUrl={posterPreview ?? movie.posterUrl ?? undefined}
                onChange={setPosterFile}
                emptyState={posterEmptyState}
              />
            </TmdbTaggedField>
            <TmdbTaggedField fromTmdb={coverFromTmdb}>
              <FileUploadField
                label={t.movies.editDialog.bannerLabel}
                accept="image/*"
                variant="image"
                aspect="wide"
                file={coverFile}
                previewUrl={coverPreview ?? movie.coverUrl ?? undefined}
                onChange={setCoverFile}
                emptyState={coverEmptyState}
              />
            </TmdbTaggedField>
            <FileUploadField
              label={t.movies.editDialog.thumbnailLabel}
              accept="image/*"
              variant="image"
              aspect="wide"
              file={thumbnailFile}
              previewUrl={thumbnailPreview ?? movie.thumbnailUrl ?? undefined}
              onChange={setThumbnailFile}
            />
          </div>
          {(posterFromTmdb || coverFromTmdb) && (
            <p className="text-xs text-muted-foreground">{t.tmdbPages.editMovie.ownPictureHint}</p>
          )}
        </div>

        {movie.status === "READY_TO_PUBLISH" && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-warning/25 bg-warning/10 p-3">
            <div>
              <p className="text-sm font-medium">{t.movies.editDialog.readyToPublishTitle}</p>
              <p className="text-xs text-muted-foreground">{t.movies.editDialog.readyToPublishDescription}</p>
            </div>
            <Button size="sm" onClick={() => void handlePublishPress()} disabled={publishing}>
              {publishing ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
              {t.movies.publish}
            </Button>
          </div>
        )}

      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || replacingVideo}>
          {t.common.cancel}
        </Button>
        <Button onClick={() => handleSave()} disabled={saving || replacingVideo || !title.trim()}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t.movies.editDialog.saveChanges}
        </Button>
      </DialogFooter>

      {/* Inside this dialog, so it opens on top of it. "Go back" closes it
          and nothing else happens. */}
      <ConfirmDialog
        open={publishQuestionOpen}
        onOpenChange={(open) => !open && setPublishQuestionOpen(false)}
        title={publishQuestion?.words.title ?? ""}
        description={publishQuestion?.words.description ?? ""}
        confirmLabel={publishQuestion?.words.confirmLabel}
        cancelLabel={publishQuestion?.words.cancelLabel}
        onConfirm={handlePublishAnyway}
      />
    </>
  );
}

/** The movie the form is seeded from, and which load it came from. */
interface LoadedMovie {
  /** The answer of GET /movies/:id this was taken from — a newer answer re-seeds the form. */
  fetched: Movie;
  /** The baseline Save is compared with: `fetched`, plus a Publish done inside the dialog. */
  movie: Movie;
  /** Counts the loads; it keys the form, so every load starts it afresh. */
  version: number;
}

/**
 * One opening of the dialog for one title. Details can change on the server
 * while the dialog is open — a TMDB lookup ends, staff apply a match — so
 * the dialog no longer trusts the row the page handed it
 * (docs/movie-details-tmdb-2026-11-06/PLAN.md §6):
 *
 * 1. On open it loads the fresh movie (GET /movies/:id) and, for a
 *    standalone movie, its TMDB state.
 * 2. Save sends only the fields staff changed (the form, above).
 * 3. After an Apply, or when "Finding details…" ends, it loads the movie
 *    again and the form starts afresh from it. While the lookup runs the
 *    form waits: there is nothing sensible to edit a moment before the
 *    details arrive. A movie opened while its folder still uploads is
 *    watched for the lookup that starts when the upload finishes; a form
 *    staff have typed into is never taken away or re-seeded (it is loaded
 *    again once nothing in it is unsaved any more), and Save rebuilds a
 *    changed cast or category list on the server's copy. Until that load
 *    the form is told it is behind the server (`behindServer`): it stops
 *    saying what is still needed, and a publish reads the movie first.
 *
 * Episodes are never looked up, so they get no strip and no TMDB request —
 * for them the dialog is the form it always was, with the Burmese box added.
 */
function EditMovieSession({
  target,
  onOpenChange,
  onSaved,
}: {
  target: EditMovieTarget;
  onOpenChange: (open: boolean) => void;
  onSaved: (movie: Movie) => void;
}) {
  const { t } = useLanguage();
  const { can } = useRole();

  const {
    data: fetched,
    isLoading,
    error: loadError,
    refetch,
  } = useAsyncData(() => movieService.getMovieById(target.id), [target.id]);
  const { data: categories } = useAsyncData(movieService.getCategories, []);

  // Each answer of the load becomes the form's new starting point. Adjusting
  // state while rendering is React's documented way to follow a changed
  // input: it re-renders straight away, before anything is shown.
  const [loaded, setLoaded] = useState<LoadedMovie | null>(null);
  // True from the moment a reload is asked for until its answer is the
  // form's starting point, so the old values are never shown in between.
  const [reloading, setReloading] = useState(false);
  if (fetched && loaded?.fetched !== fetched) {
    setLoaded({ fetched, movie: fetched, version: (loaded?.version ?? 0) + 1 });
    setReloading(false);
  }
  const movie = loaded?.movie ?? null;
  const standalone = movie !== null && movie.seriesId === null;

  // Always the page's latest callback, for a reload that lands later.
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  });

  // A reload asked for because the details changed on the server: when it
  // lands the page is handed the fresh movie too, so its row or card shows
  // the new name and poster.
  const announceRef = useRef(false);
  useEffect(() => {
    if (!fetched || !announceRef.current) return;
    announceRef.current = false;
    onSavedRef.current(fetched);
  }, [fetched]);
  // A lookup ended while the form held unsaved changes, so its reload was
  // skipped: the form is behind the server until it is loaded again.
  const [arrivedUnseen, setArrivedUnseen] = useState(false);
  // …and that lookup filled the movie in: the form lacks a poster, a cast
  // and categories that are stored by now. The form is told, so it does not
  // call them missing (`behindServer`).
  const [filledUnseen, setFilledUnseen] = useState(false);
  const reloadChangedMovie = useCallback(() => {
    announceRef.current = true;
    setArrivedUnseen(false);
    setFilledUnseen(false);
    setReloading(true);
    refetch();
  }, [refetch]);

  // Whether the form holds unsaved changes right now (the form reports it):
  // the ref for a callback that lands later, the state for what is drawn.
  const unsavedRef = useRef(false);
  const [formUnsaved, setFormUnsaved] = useState(false);
  const reportUnsaved = useCallback((unsaved: boolean) => {
    unsavedRef.current = unsaved;
    setFormUnsaved(unsaved);
  }, []);
  // Staff undid what they had typed, and details arrived meanwhile: the
  // skipped reload happens now, so the form shows the filled-in movie. It
  // follows the state, not the form's report itself: the form also reports
  // "nothing unsaved" for an instant whenever its effect runs again, and a
  // reload at that instant would wipe what is typed.
  useEffect(() => {
    // Asking for the reload is the answer to two things that happened (the
    // details arrived, the edit was undone) — not state derived from state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (arrivedUnseen && !formUnsaved) reloadChangedMovie();
  }, [arrivedUnseen, formUnsaved, reloadChangedMovie]);

  // ---- Details from TMDB (standalone movies) ----
  // The status and the state both ask MOVIES.VIEW. "Not connected" is only
  // what the server itself said; an unknown status keeps the strip.
  const canSeeTmdb = can("MOVIES.VIEW");
  const canUseTmdb = can("MOVIES.EDIT") && can("MEDIA.UPLOAD");
  const connection = useTmdbConnection({ enabled: canSeeTmdb && standalone });
  // Nothing of TMDB is asked or drawn before the server has answered about
  // its key. It answers the states without one too (every status NONE, for
  // the folder name), so a strip drawn from the state alone would offer a
  // "Find details" that can only be refused.
  const connectionAnswered = connection.status !== null || connection.error !== null;
  const statesUse = tmdbStatesUse(canSeeTmdb, connectionAnswered, connection.notConnected);
  // A folder that is still uploading is looked up by the server the moment
  // its upload finishes — which this dialog cannot see. So where the server
  // really looks titles up, the state of such a movie is read again every
  // few seconds for as long as the dialog is open, and the lookup's result
  // arrives like one the dialog watched (`onSettled`). FAILED counts as
  // still uploading: an upload whose last step was refused is tried again
  // from its card, and ends in the same lookup.
  const uploadRunning = movie !== null && (movie.status === "UPLOADING" || movie.status === "FAILED");
  const tmdb = useTmdbStates(standalone ? [movie.id] : [], {
    enabled: statesUse !== "none",
    watchUnstarted: uploadRunning && connection.status?.configured === true,
    onSettled: (state) => {
      // A lookup ended. The form was waiting (or had nothing typed into
      // it), so it starts again from the filled-in movie — unless staff
      // have typed into it: then their edits stay, Save still sends only
      // what they changed, and the form is loaded again as soon as nothing
      // is unsaved any more (the effect above). The toast says which.
      const filled = state.status === "MATCHED";
      if (!unsavedRef.current) {
        reloadChangedMovie();
        if (filled) toast.success(t.tmdbPages.editMovie.detailsArrivedToast);
        return;
      }
      setArrivedUnseen(true);
      if (filled) {
        setFilledUnseen(true);
        toast.success(t.tmdbPages.editMovie.detailsArrivedToast, {
          description: t.tmdbPages.editMovie.detailsArrivedUnsavedHint,
        });
      }
    },
  });
  const tmdbState = standalone ? (tmdb.states.get(movie.id) ?? null) : null;
  // Only what the server itself said: the strip then shows the folder name
  // and that sentence, and nothing to press.
  const tmdbNotConnected = statesUse === "folders";
  // No strip when there is nothing to put in it: the state was refused for
  // another reason (no permission, an older server).
  const stripShown = standalone && canSeeTmdb && (tmdbNotConnected || tmdbState !== null);
  // After 3 minutes the form comes back, so a lookup that never ends cannot
  // lock a title out of editing; the strip then offers Try again. From then
  // on the form stays: pressing Try again only reads the state once more,
  // and hiding the form for it would throw away what staff typed meanwhile.
  // Only a lookup staff start themselves makes the form wait again.
  const [waitGivenUp, setWaitGivenUp] = useState(false);
  if (tmdb.timedOut && !waitGivenUp) setWaitGivenUp(true);
  // Never while the form holds unsaved changes: a lookup the server started
  // by itself (the upload just finished) must not take the form, and what
  // staff typed into it, off the screen.
  const waitingForDetails =
    statesUse === "all" && tmdbState?.status === "PENDING" && !waitGivenUp && !formUnsaved;

  const [lookupBusy, setLookupBusy] = useState(false);
  const [matchStart, setMatchStart] = useState<"pick" | "refill" | null>(null);

  const handleTmdbAction = async (action: TmdbAction) => {
    if (!movie) return;
    if (action === "refresh") {
      tmdb.refresh();
      return;
    }
    if (tmdbActionOpensDialog(action)) {
      setMatchStart(action === "refill" ? "refill" : "pick");
      return;
    }
    // "Find details" / "Try again": the automatic lookup, in the background.
    setLookupBusy(true);
    try {
      await tmdbService.lookupMovie(movie.id);
      tmdb.markPending(movie.id);
      // A fresh lookup, started with nothing unsaved: the form waits for it.
      setWaitGivenUp(false);
    } catch (err) {
      toast.error(t.tmdbPages.readyToPublish.lookupFailedToast, { description: tmdbErrorMessage(err, t) });
      // Refused because the strip is behind the server: a lookup is already
      // running, or the movie is matched by now.
      const code = tmdbErrorCode(err);
      if (code === "TMDB_BUSY") tmdb.refresh();
      // Matched by now: a lookup ended that this dialog never saw run, so
      // the form is behind the server. Marked as a lookup under way, the
      // state is read again and comes back matched — which ends it like any
      // other: `onSettled` loads the movie again (unless staff have typed
      // into the form).
      if (code === "TMDB_ALREADY_MATCHED") tmdb.markPending(movie.id);
    } finally {
      setLookupBusy(false);
    }
  };

  const stripProps: EditMovieTmdb | null = stripShown
    ? {
        state: tmdbState,
        notConnected: tmdbNotConnected,
        canAct: canUseTmdb,
        busy: lookupBusy,
        timedOut: tmdb.timedOut,
        onAction: handleTmdbAction,
      }
    : null;

  // The form is shown only once everything it starts from is there: the
  // movie, and for a movie the first answers about TMDB (the key, then the
  // state) — otherwise a title still being looked up would flash its
  // half-empty form first, or a server without a key a button.
  const stillLoading =
    isLoading || reloading || (standalone && canSeeTmdb && (!connectionAnswered || tmdb.isLoading));

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t.movies.editDialog.title}</DialogTitle>
        <DialogDescription>{t.movies.editDialog.descriptionFor(movie?.title ?? target.title)}</DialogDescription>
      </DialogHeader>

      {loadError ? (
        // Never a form over a movie that could not be read: what it showed
        // might not be what is stored.
        <ErrorState className="py-10" description={t.tmdbPages.editMovie.loadFailed} onRetry={refetch} />
      ) : stillLoading || !loaded ? (
        <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t.tmdbPages.editMovie.loading}
        </p>
      ) : waitingForDetails && stripProps ? (
        <>
          <div className="flex flex-col gap-4">
            <TmdbStrip {...stripProps} />
            <p className="text-sm text-muted-foreground" role="status">
              {t.tmdbPages.editMovie.waitingForDetails}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t.common.close}
            </Button>
          </DialogFooter>
        </>
      ) : (
        <EditMovieForm
          key={`${loaded.movie.id}:${loaded.version}`}
          movie={loaded.movie}
          categories={categories}
          tmdb={stripProps}
          behindServer={filledUnseen}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
          onPublished={(updated) => {
            // Only the status moves in the baseline: the rest of the form
            // was seeded from the load and is still compared with it.
            setLoaded((prev) => prev && { ...prev, movie: { ...prev.movie, status: updated.status } });
            onSaved(updated);
          }}
          onUnsavedChange={reportUnsaved}
        />
      )}

      {/* Inside this dialog, so it opens on top of it. It stays mounted
          through the reload an Apply starts: its summary is still showing. */}
      <TmdbMatchDialog
        open={matchStart !== null}
        onOpenChange={(open) => !open && setMatchStart(null)}
        target={matchStart !== null && movie ? tmdbTargetOfMovie(movie, tmdbState) : null}
        start={matchStart ?? undefined}
        onApplied={() => {
          reloadChangedMovie();
          tmdb.refresh();
        }}
        // Refused or broken off: load the movie again so nothing half-done is shown.
        onApplyFailed={() => {
          reloadChangedMovie();
          tmdb.refresh();
        }}
      />
    </>
  );
}

export function EditMovieDialog({
  movie,
  open,
  onOpenChange,
  onSaved,
}: {
  /** The title to edit; null while the dialog is closed. */
  movie: EditMovieTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The movie changed on the server and this is how it is stored now: after
   * Save, after Publish inside the dialog, and after details from TMDB were
   * filled in while it was open.
   */
  onSaved: (movie: Movie) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {movie && (
          <EditMovieSession key={movie.id} target={movie} onOpenChange={onOpenChange} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
}
