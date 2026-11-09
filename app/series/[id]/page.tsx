"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  EyeOff,
  GripVertical,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  Rocket,
  RotateCcw,
  Trash2,
  WifiOff,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { ErrorState } from "@/components/shared/ErrorState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { STATUS_TONE, getStatusLabel } from "@/components/movies/columns";
import { SERIES_STATUS_TONE, getSeriesStatusLabel } from "@/components/series/columns";
import { EditMovieDialog } from "@/components/movies/EditMovieDialog";
import { ActorPicker } from "@/components/actors/ActorPicker";
import {
  DESCRIPTION_MAX_LENGTH,
  DescriptionLanguageSection,
  descriptionProblem,
  isDescriptionRequiredError,
} from "@/components/shared/DescriptionLanguageSection";
import { MediaTypeSelect } from "@/components/shared/MediaTypeSelect";
import { FileUploadField } from "@/components/movies/FileUploadField";
import { TmdbTaggedField } from "@/components/tmdb/TmdbFromTag";
import { TmdbMatchDialog, tmdbTargetOfSeries } from "@/components/tmdb/TmdbMatchDialog";
import { TmdbStrip } from "@/components/tmdb/TmdbStrip";
import type { TmdbAction } from "@/components/tmdb/tmdbStatus";
import { tmdbErrorCode } from "@/components/tmdb/tmdbWords";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useObjectUrl } from "@/lib/hooks/use-object-url";
import { useTmdbConnection } from "@/lib/hooks/use-tmdb-states";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import {
  useBulkUploadQueue,
  MAX_BULK_MOVIES,
  totalBytes,
  uploadedBytes,
  type MovieUploadJob,
} from "@/lib/context/bulk-upload-context";
import { foldersFromFileList, parseEpisodeNumber } from "@/lib/upload/read-dropped-folders";
import { formatEta, formatSpeed } from "@/lib/upload/format";
import { GENRE_OPTIONS, LANGUAGES } from "@/lib/constants/movie-options";
import { parseRatingInput, ratingToInput } from "@/lib/rating";
import { movieService } from "@/services/api/movieService";
import { seriesService } from "@/services/api/seriesService";
import { tmdbService } from "@/services/api/tmdbService";
import { uploadService } from "@/services/api/uploadService";
import type { Movie } from "@/types/movie";
import type { Series } from "@/types/series";
import { toast } from "sonner";

/** One row of a season's list — a server episode, possibly overlaid with its live upload job. */
interface EpisodeRow {
  episode: Movie;
  job: MovieUploadJob | null;
}

const ACTIVE_JOB_STATUSES = new Set(["waiting", "uploading", "paused", "offline", "completed", "failed"]);

/** Same ids, whatever the order — a cast or category list is a set. */
function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const seen = new Set(a);
  return b.every((id) => seen.has(id));
}

function SeriesManageContent() {
  const { t } = useLanguage();
  const { can } = useRole();
  // Everything on this screen edits one show: episodes are created by
  // uploading media into it, so they follow the parent series' permissions.
  const canEdit = can("SERIES.EDIT");
  const canDelete = can("SERIES.DELETE");
  const canPublish = can("SERIES.PUBLISH");
  const canUnpublish = can("SERIES.UNPUBLISH");
  const canUploadMedia = can("MEDIA.UPLOAD");
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const seriesId = params.id;

  const {
    data: series,
    error: seriesError,
    refetch: refetchSeries,
  } = useAsyncData(() => seriesService.getSeriesById(seriesId), [seriesId]);

  const { data: episodes, refetch: refetchEpisodes } = useAsyncData(
    () => seriesService.getEpisodes(seriesId),
    [seriesId],
  );
  const { data: categories } = useAsyncData(movieService.getCategories, []);

  // Each series gets its own persisted queue — navigating between shows
  // never mixes their uploads together.
  const queue = useBulkUploadQueue(`myanflix-episode-queue-${seriesId}`);

  // ---- Series info form ----
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionMm, setDescriptionMm] = useState("");
  const [genre, setGenre] = useState("");
  const [language, setLanguage] = useState("English");
  const [country, setCountry] = useState<string | null>(null);
  const [releaseYear, setReleaseYear] = useState("");
  const [rating, setRating] = useState("");
  const [accessType, setAccessType] = useState<Series["accessType"]>("SUBSCRIPTION");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  // Show-level cast. PUT `set`s the whole list, so this is seeded from the
  // stored cast and echoed back on every save — an empty array would wipe it.
  const [actorIds, setActorIds] = useState<string[]>([]);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const thumbnailPreview = useObjectUrl(thumbnailFile);
  const bannerPreview = useObjectUrl(bannerFile);
  const [savingInfo, setSavingInfo] = useState(false);
  const infoSeededRef = useRef(false);
  // Set when the stored show changed under the form — a save, or details
  // applied from TMDB — so the next load fills the form again. Any other
  // reload (a publish, say) must leave what staff are typing alone, which
  // is why the form is not simply re-seeded on every load.
  const reseedInfoRef = useRef(false);

  useEffect(() => {
    if (!series) return;
    if (infoSeededRef.current && !reseedInfoRef.current) return;
    infoSeededRef.current = true;
    reseedInfoRef.current = false;
    setTitle(series.title);
    setDescription(series.description);
    // `?? ""`: a backend from before the Burmese description leaves the field out.
    setDescriptionMm(series.descriptionMm ?? "");
    setGenre(series.genre);
    setLanguage(series.language);
    setCountry(series.country ?? null);
    setReleaseYear(String(series.releaseYear));
    setRating(ratingToInput(series.rating));
    setAccessType(series.accessType);
    setCategoryIds(series.categories.map((c) => c.id));
    // `?? []` guards a response cached before the cast field existed.
    setActorIds((series.actors ?? []).map((a) => a.id));
    // The stored pictures are what the form shows from here on.
    setThumbnailFile(null);
    setBannerFile(null);
  }, [series]);

  // ---- Details from TMDB (the show itself; episodes are not looked up) ----
  // Filling saves pictures, so it needs MEDIA.UPLOAD on top of SERIES.EDIT.
  // "Not connected" is only what the server itself said: its status (which
  // asks MOVIES.VIEW), or the state route refusing for want of a key.
  const canUseTmdb = canEdit && canUploadMedia;
  const tmdbConnection = useTmdbConnection({ enabled: can("MOVIES.VIEW") });
  const {
    data: tmdbStateData,
    error: tmdbStateError,
    refetch: refetchTmdbState,
  } = useAsyncData(() => tmdbService.getSeriesState(seriesId), [seriesId]);
  const tmdbState = tmdbStateError ? null : tmdbStateData;
  const tmdbNotConnected =
    tmdbConnection.notConnected || tmdbErrorCode(tmdbStateError) === "TMDB_NOT_CONFIGURED";
  // No strip when the state was refused for another reason (an older server).
  const tmdbStripShown = tmdbNotConnected || tmdbStateError === null;
  const [tmdbStart, setTmdbStart] = useState<"pick" | "refill" | null>(null);

  const handleTmdbAction = (action: TmdbAction) => {
    if (action === "refresh") {
      refetchTmdbState();
      return;
    }
    // Nothing looks a series up in the background: "Find details" and
    // "Change match" open the list, "Refill" the review of the show it has.
    setTmdbStart(action === "refill" ? "refill" : "pick");
  };

  /** The stored show changed: load it again, fill the form from it, and read what TMDB now says about it. */
  const reloadInfo = () => {
    reseedInfoRef.current = true;
    refetchSeries();
    refetchTmdbState();
  };

  const handleSaveInfo = async () => {
    // What is missing is asked for by name, one thing at a time. A show
    // filled from TMDB can arrive without a genre or a language word (TMDB
    // had none that maps), and "save failed" would not say which.
    if (!title.trim()) {
      toast.error(t.tmdbPages.series.nameRequired);
      return;
    }
    // One language is enough, but a show needs a description in at least one.
    const problem = descriptionProblem(description, descriptionMm, { required: true });
    if (problem === "missing") {
      toast.error(t.tmdbPages.series.descriptionRequired);
      return;
    }
    if (problem === "too_long") {
      toast.error(t.tmdbPages.editMovie.descriptionTooLong(DESCRIPTION_MAX_LENGTH));
      return;
    }
    if (!genre) {
      toast.error(t.tmdbPages.series.genreRequired);
      return;
    }
    if (!language) {
      toast.error(t.tmdbPages.series.languageRequired);
      return;
    }
    // Empty is a value here (0 = unrated); only a malformed rating blocks the save.
    const ratingValue = parseRatingInput(rating);
    if (ratingValue === null) {
      toast.error(t.series.form.ratingInvalidToast);
      return;
    }
    setSavingInfo(true);
    try {
      const [posterUrl, coverUrl] = await Promise.all([
        thumbnailFile ? uploadService.uploadImage(thumbnailFile, "series").then((r) => r.url) : undefined,
        bannerFile ? uploadService.uploadImage(bannerFile, "series").then((r) => r.url) : undefined,
      ]);
      await seriesService.updateSeries(seriesId, {
        title: title.trim(),
        description: description.trim(),
        // "" clears the Burmese text (stored as none).
        descriptionMm: descriptionMm.trim(),
        genre,
        language,
        country: country ?? "",
        releaseYear: Number(releaseYear) || new Date().getFullYear(),
        rating: ratingValue,
        accessType,
        categoryIds,
        actorIds,
        // A picture goes out only when a new one was picked; otherwise the
        // stored one — staff's own or TMDB's — is left exactly as it is.
        ...(posterUrl ? { posterUrl } : {}),
        ...(coverUrl ? { coverUrl } : {}),
      });
      toast.success(t.series.manage.savedToast);
      reloadInfo();
    } catch (err) {
      if (isDescriptionRequiredError(err)) toast.error(t.tmdbPages.series.descriptionRequired);
      else toast.error(t.series.saveFailedToast, { description: t.movies.pleaseTryAgain });
    } finally {
      setSavingInfo(false);
    }
  };

  // ---- Seasons & episodes ----
  const jobsById = useMemo(() => new Map(queue.jobs.map((j) => [j.movieId, j])), [queue.jobs]);

  // Locally-added seasons that don't have episodes yet — purely a UI
  // affordance so "+ Add Season" shows an empty section to drop into.
  const [extraSeasons, setExtraSeasons] = useState<number[]>([]);
  // Optimistic per-season order override while a drag-reorder's PUTs are in flight.
  const [orderOverride, setOrderOverride] = useState<Record<number, string[]>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const seasonMap = useMemo(() => {
    const map = new Map<number, EpisodeRow[]>();
    for (const episode of episodes ?? []) {
      const season = episode.seasonNumber ?? 1;
      if (!map.has(season)) map.set(season, []);
      map.get(season)!.push({ episode, job: jobsById.get(episode.id) ?? null });
    }
    for (const [season, rows] of map) {
      const override = orderOverride[season];
      if (override) {
        rows.sort((a, b) => override.indexOf(a.episode.id) - override.indexOf(b.episode.id));
      } else {
        rows.sort((a, b) => (a.episode.episodeNumber ?? 0) - (b.episode.episodeNumber ?? 0));
      }
    }
    for (const season of extraSeasons) if (!map.has(season)) map.set(season, []);
    return new Map([...map.entries()].sort(([a], [b]) => a - b));
  }, [episodes, jobsById, extraSeasons, orderOverride]);

  // Auto-refresh the episode list whenever an upload finishes (its status
  // flips to ready_to_publish), so the settled row replaces the live one.
  const readyCount = queue.jobs.filter((j) => j.status === "ready_to_publish").length;
  const prevReadyRef = useRef(readyCount);
  useEffect(() => {
    if (readyCount > prevReadyRef.current) refetchEpisodes();
    prevReadyRef.current = readyCount;
  }, [readyCount, refetchEpisodes]);

  // ---- Adding episodes to a season ----
  const folderInputRef = useRef<HTMLInputElement>(null);
  const pendingSeasonRef = useRef(1);
  const [addingToSeason, setAddingToSeason] = useState<number | null>(null);

  const handleAddFolders = async (fileList: FileList | null) => {
    const seasonNumber = pendingSeasonRef.current;
    const folders = fileList ? foldersFromFileList(fileList).filter((f) => f.files.length > 0) : [];
    if (folders.length === 0) return;

    const remainingSlots = MAX_BULK_MOVIES - queue.jobs.length;
    const toAdd = folders.slice(0, Math.max(0, remainingSlots));
    if (toAdd.length === 0) {
      toast.error(t.series.manage.tooManyEpisodesToast(MAX_BULK_MOVIES));
      return;
    }
    if (toAdd.length < folders.length) {
      toast.error(t.series.manage.partialAddToast(toAdd.length, folders.length, MAX_BULK_MOVIES));
    }

    setAddingToSeason(seasonNumber);
    try {
      // The server is the authority on taken episode numbers — placeholders
      // are real rows the moment they're queued.
      const existing = await seriesService.getEpisodes(seriesId, seasonNumber);
      const taken = new Set(existing.map((e) => e.episodeNumber).filter((n): n is number => n != null));
      let nextFree = taken.size > 0 ? Math.max(...taken) + 1 : 1;

      const episodeNumbers = toAdd.map((folder) => {
        const parsed = parseEpisodeNumber(folder.folderName);
        let assigned: number;
        if (parsed !== null && !taken.has(parsed)) {
          assigned = parsed;
        } else {
          while (taken.has(nextFree)) nextFree++;
          assigned = nextFree;
        }
        taken.add(assigned);
        if (assigned >= nextFree) nextFree = assigned + 1;
        return assigned;
      });

      const added = await queue.addFolders(toAdd, { seriesId, seasonNumber, episodeNumbers });
      if (added > 0) {
        toast.success(t.series.manage.episodesAddedToast(added, seasonNumber));
        // Placeholders exist server-side already — refetch so the new rows
        // appear in the season immediately, alongside the existing ones.
        refetchEpisodes();
      }
    } catch {
      toast.error(t.series.manage.queueFailedToast, { description: t.movies.pleaseTryAgain });
    } finally {
      setAddingToSeason(null);
    }
  };

  // ---- Reorder (drag ☰ within a season) ----
  const handleReorder = async (seasonNumber: number, fromId: string, toIndex: number) => {
    const rows = seasonMap.get(seasonNumber) ?? [];
    const ids = rows.map((r) => r.episode.id);
    const fromIndex = ids.indexOf(fromId);
    if (fromIndex === -1 || fromIndex === toIndex) return;

    const reorderedIds = [...ids];
    const [moved] = reorderedIds.splice(fromIndex, 1);
    reorderedIds.splice(toIndex, 0, moved);

    setOrderOverride((prev) => ({ ...prev, [seasonNumber]: reorderedIds }));
    setReordering(true);
    try {
      // Renumber sequentially in the new order; only rows whose number
      // actually changed get a PUT.
      const byId = new Map(rows.map((r) => [r.episode.id, r.episode]));
      for (const [index, id] of reorderedIds.entries()) {
        const episode = byId.get(id)!;
        const newNumber = index + 1;
        if (episode.episodeNumber !== newNumber) {
          await movieService.updateMovie(id, { episodeNumber: newNumber });
        }
      }
      await refetchEpisodes();
    } catch {
      toast.error(t.series.manage.reorderFailedToast, { description: t.movies.pleaseTryAgain });
    } finally {
      setOrderOverride((prev) => {
        const next = { ...prev };
        delete next[seasonNumber];
        return next;
      });
      setReordering(false);
    }
  };

  // ---- Show-level publish/unpublish ----
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const handleToggleSeriesStatus = async () => {
    if (!series) return;
    const publishing = series.status !== "PUBLISHED";
    setUpdatingStatus(true);
    try {
      await seriesService.updateStatus(seriesId, publishing ? "PUBLISHED" : "UNPUBLISHED");
      if (publishing) {
        toast.success(t.series.publishedToast, { description: t.series.publishedDescription(series.title) });
      } else {
        toast.success(t.series.unpublishedToast, { description: t.series.unpublishedDescription(series.title) });
      }
      refetchSeries();
    } catch {
      toast.error(t.series.statusUpdateFailedToast, { description: t.movies.pleaseTryAgain });
    } finally {
      setUpdatingStatus(false);
      setStatusConfirmOpen(false);
    }
  };

  // ---- Series deletion (whole show + all seasons/episodes + media files) ----
  const [deleteSeriesOpen, setDeleteSeriesOpen] = useState(false);
  const [deletingSeries, setDeletingSeries] = useState(false);

  const handleDeleteSeries = async () => {
    if (!series) return;
    setDeletingSeries(true);
    try {
      const result = await seriesService.deleteSeries(seriesId);
      if (result.storageCleanup === "partial") {
        toast.warning(t.series.page.deletedPartialToast(result.failedObjects.length));
      } else {
        toast.success(t.series.page.deletedToast, {
          description: t.series.page.deletedDescription(series.title),
        });
      }
      router.push("/series");
    } catch {
      toast.error(t.series.page.deleteFailedToast, { description: t.movies.pleaseTryAgain });
    } finally {
      setDeletingSeries(false);
      setDeleteSeriesOpen(false);
    }
  };

  // ---- Row actions ----
  const [editMovie, setEditMovie] = useState<Movie | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Movie | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handlePublish = async (episode: Movie) => {
    try {
      await movieService.updateMovie(episode.id, { status: "PUBLISHED" });
      queue.markPublished(episode.id);
      refetchEpisodes();
      toast.success(t.series.episodePublishedToast, { description: t.movies.publishedDescription(episode.title) });
    } catch {
      toast.error(t.series.publishFailedToast, { description: t.movies.pleaseTryAgain });
    }
  };

  const handleRemoveJob = async (row: EpisodeRow) => {
    // Removing an in-flight upload also removes its placeholder row —
    // otherwise the season would keep a permanently-"Uploading" ghost.
    queue.remove(row.episode.id);
    try {
      await movieService.deleteMovie(row.episode.id);
    } catch {
      // already gone is fine
    }
    refetchEpisodes();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await movieService.deleteMovie(deleteTarget.id);
      queue.remove(deleteTarget.id);
      refetchEpisodes();
      toast.success(t.series.episodeDeletedToast, { description: t.series.manage.episodeDeletedDescription(deleteTarget.title) });
    } catch {
      toast.error(t.series.manage.deleteFailedToast, { description: t.movies.pleaseTryAgain });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const nextSeasonNumber = useMemo(() => {
    const seasons = [...seasonMap.keys()];
    return seasons.length > 0 ? Math.max(...seasons) + 1 : 1;
  }, [seasonMap]);

  if (seriesError) {
    return (
      <div>
        <PageHeader title={t.series.manage.errorTitle} description={t.series.manage.errorDescription} />
        <ErrorState description={t.series.manage.loadError} onRetry={refetchSeries} />
      </div>
    );
  }

  // The first load only. A later reload — after a save, a publish, details
  // applied from TMDB — keeps the page on screen while the fresh show
  // arrives; blanking it would also close the TMDB dialog, whose summary is
  // still showing at that moment.
  if (!series || series.id !== seriesId) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Whether the card holds changes that are not stored yet. The TMDB
  // buttons wait for a save: a fill is reviewed against what is stored, not
  // against what is typed.
  const infoUnsaved =
    title.trim() !== series.title.trim() ||
    description.trim() !== (series.description ?? "").trim() ||
    descriptionMm.trim() !== (series.descriptionMm ?? "").trim() ||
    genre !== series.genre ||
    language !== series.language ||
    (country ?? "") !== (series.country ?? "") ||
    Number(releaseYear) !== series.releaseYear ||
    parseRatingInput(rating) !== series.rating ||
    accessType !== series.accessType ||
    !sameIds(categoryIds, series.categories.map((c) => c.id)) ||
    !sameIds(actorIds, (series.actors ?? []).map((a) => a.id)) ||
    thumbnailFile !== null ||
    bannerFile !== null;

  // A word outside the list stays choosable, so the card never loses it.
  const languageOptions =
    series.language && !LANGUAGES.includes(series.language) ? [...LANGUAGES, series.language] : LANGUAGES;

  // The "From TMDB" marks only say where a value came from: a picked file,
  // or a letter typed in the English box, makes its mark go.
  const posterFromTmdb = tmdbState?.images.poster === "tmdb" && !thumbnailFile;
  const bannerFromTmdb = tmdbState?.images.cover === "tmdb" && !bannerFile;
  const englishFromTmdb =
    (tmdbState?.autoFields.includes("description") ?? false) && description === series.description;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={series.title}
        description={t.series.manage.description}
        actions={
          <>
            <StatusBadge
              label={getSeriesStatusLabel(t, series.status)}
              tone={SERIES_STATUS_TONE[series.status]}
            />
            {(series.status === "PUBLISHED" ? canUnpublish : canPublish) && (
              <Button disabled={updatingStatus} onClick={() => setStatusConfirmOpen(true)}>
                {series.status === "PUBLISHED" ? (
                  <>
                    <EyeOff className="size-4" />
                    {t.series.unpublish}
                  </>
                ) : (
                  <>
                    <Rocket className="size-4" />
                    {t.movies.publish}
                  </>
                )}
              </Button>
            )}
            {canDelete && (
              <Button
                variant="destructive"
                disabled={deletingSeries}
                onClick={() => setDeleteSeriesOpen(true)}
              >
                <Trash2 className="size-4" />
                {t.series.manage.deleteSeries}
              </Button>
            )}
          </>
        }
      />

      {!queue.isOnline && (
        <div className="flex items-center gap-3 rounded-lg border border-info/25 bg-info/10 px-4 py-3">
          <WifiOff className="size-5 shrink-0 text-info" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-info">{t.movies.externalUpload.waitingForConnection}</p>
            <p className="text-xs text-muted-foreground">
              {t.movies.externalUpload.waitingForConnectionDescription}
            </p>
          </div>
        </div>
      )}

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>{t.series.manage.infoCardTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Not linked: Find details. Linked: the match, Refill and Change match. */}
          {tmdbStripShown && (
            <TmdbStrip
              state={tmdbState}
              notConnected={tmdbNotConnected}
              unsaved={infoUnsaved}
              canAct={canUseTmdb && !savingInfo}
              onAction={handleTmdbAction}
            />
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="series-title">{t.tmdbPages.series.nameLabel}</Label>
            <Input id="series-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          {/* English is what TMDB fills; Burmese is typed by hand, at any time. */}
          <DescriptionLanguageSection
            idPrefix="series-info"
            layout="columns"
            rows={4}
            english={description}
            burmese={descriptionMm}
            onEnglishChange={setDescription}
            onBurmeseChange={setDescriptionMm}
            englishFromTmdb={englishFromTmdb}
            disabled={savingInfo}
          />
          <div className="grid grid-cols-4 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t.series.form.genreLabel}</Label>
              <Select value={genre} onValueChange={(v) => v && setGenre(v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder={t.movies.editDialog.genrePlaceholder} /></SelectTrigger>
                <SelectContent>
                  {GENRE_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t.series.form.languageLabel}</Label>
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
              <Label htmlFor="series-year">{t.series.form.releaseYearLabel}</Label>
              <Input id="series-year" type="number" value={releaseYear} onChange={(e) => setReleaseYear(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="series-rating">{t.series.form.ratingLabel}</Label>
              <Input
                id="series-rating"
                type="number"
                min="0"
                max="10"
                step="0.1"
                inputMode="decimal"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
              />
              {rating === "" && <p className="text-xs text-muted-foreground">{t.series.form.ratingHint}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t.series.form.accessTypeLabel}</Label>
              <Select value={accessType} onValueChange={(v) => v && setAccessType(v as Series["accessType"])}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">{t.movies.accessType.free}</SelectItem>
                  <SelectItem value="SUBSCRIPTION">{t.movies.accessType.subscription}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t.series.form.accessTypeHelp}</p>
            </div>
            <MediaTypeSelect kind="series" value={country} onChange={setCountry} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t.series.manage.categoriesLabel}</Label>
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
          <ActorPicker value={actorIds} onChange={setActorIds} disabled={savingInfo} hint={t.actors.picker.seriesHint} />
          <div className="grid grid-cols-2 gap-4">
            <TmdbTaggedField fromTmdb={posterFromTmdb}>
              <FileUploadField
                label={t.series.manage.thumbnailLabel}
                accept="image/*"
                variant="image"
                aspect="poster"
                file={thumbnailFile}
                previewUrl={thumbnailPreview ?? series.posterUrl ?? undefined}
                onChange={setThumbnailFile}
              />
            </TmdbTaggedField>
            <TmdbTaggedField fromTmdb={bannerFromTmdb}>
              <FileUploadField
                label={t.series.manage.bannerLabel}
                accept="image/*"
                variant="image"
                aspect="wide"
                file={bannerFile}
                previewUrl={bannerPreview ?? series.coverUrl ?? undefined}
                onChange={setBannerFile}
              />
            </TmdbTaggedField>
          </div>
          {(posterFromTmdb || bannerFromTmdb) && (
            <p className="text-xs text-muted-foreground">{t.tmdbPages.editMovie.ownPictureHint}</p>
          )}
          {canEdit && (
            <Button onClick={handleSaveInfo} disabled={savingInfo}>
              {savingInfo && <Loader2 className="size-4 animate-spin" />}
              {t.series.manage.saveInfo}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Shared hidden folder picker — [+] on a season header targets it via pendingSeasonRef. */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error -- webkitdirectory is a real, supported, non-standard attribute for folder selection.
        webkitdirectory=""
        multiple
        className="hidden"
        onChange={(e) => {
          void handleAddFolders(e.target.files);
          e.target.value = "";
        }}
      />

      {[...seasonMap.entries()].map(([seasonNumber, rows]) => (
        <Card key={seasonNumber} className="glass-card">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>{t.series.manage.seasonTitle(seasonNumber)}</CardTitle>
            {canUploadMedia && (
              <Button
                size="icon-sm"
                variant="outline"
                title={t.series.manage.addEpisodesTitle(seasonNumber)}
                disabled={addingToSeason !== null}
                onClick={() => {
                  pendingSeasonRef.current = seasonNumber;
                  folderInputRef.current?.click();
                }}
              >
                {addingToSeason === seasonNumber ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              </Button>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {rows.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                {t.series.manage.noEpisodesYet}
              </p>
            ) : (
              rows.map((row, index) => {
                const { episode, job } = row;
                const liveJob = job && ACTIVE_JOB_STATUSES.has(job.status) ? job : null;
                const jobPercent = liveJob
                  ? (() => {
                      const total = totalBytes(liveJob);
                      return total > 0 ? Math.round((uploadedBytes(liveJob) / total) * 100) : 0;
                    })()
                  : 0;

                return (
                  <div
                    key={episode.id}
                    draggable={!reordering}
                    onDragStart={() => setDraggingId(episode.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggingId && draggingId !== episode.id) {
                        void handleReorder(seasonNumber, draggingId, index);
                      }
                      setDraggingId(null);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    className={`flex flex-col gap-2 rounded-lg border border-border bg-secondary/20 px-3 py-2.5 transition-colors ${
                      draggingId === episode.id ? "opacity-50" : ""
                    } ${liveJob?.status === "uploading" ? "border-info/25 bg-info/10" : ""}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          <span className="text-muted-foreground">E{episode.episodeNumber ?? "?"}</span> · {episode.title}
                        </p>
                        {liveJob && liveJob.status === "uploading" && (
                          <p className="text-xs tabular-nums text-muted-foreground">
                            {formatSpeed(liveJob.speedBps)} · {formatEta(liveJob.etaSeconds)}
                          </p>
                        )}
                      </div>

                      {liveJob ? (
                        <StatusBadge
                          label={
                            liveJob.status === "offline"
                              ? t.series.manage.jobStatus.offline
                              : liveJob.status === "completed"
                                ? t.series.manage.jobStatus.validating
                                : liveJob.status === "waiting"
                                  ? t.uploads.status.waiting
                                  : liveJob.status === "uploading"
                                    ? t.uploads.status.uploading
                                    : liveJob.status === "paused"
                                      ? t.series.manage.jobStatus.paused
                                      : t.uploads.status.failed
                          }
                          tone={
                            liveJob.status === "failed"
                              ? "danger"
                              : liveJob.status === "paused"
                                ? "warning"
                                : liveJob.status === "waiting"
                                  ? "neutral"
                                  : "info"
                          }
                        />
                      ) : (
                        <StatusBadge label={getStatusLabel(t, episode.status)} tone={STATUS_TONE[episode.status]} />
                      )}

                      <div className="flex shrink-0 items-center gap-1">
                        {liveJob?.status === "uploading" && (
                          <Button size="icon-sm" variant="ghost" title={t.uploads.pause} onClick={() => queue.pause(episode.id)}>
                            <Pause className="size-3.5" />
                          </Button>
                        )}
                        {liveJob?.status === "paused" && (
                          <Button size="icon-sm" variant="ghost" title={t.uploads.resume} onClick={() => queue.resume(episode.id)}>
                            <Play className="size-3.5" />
                          </Button>
                        )}
                        {liveJob?.status === "failed" && (
                          <Button size="icon-sm" variant="ghost" title={t.common.retry} onClick={() => queue.retry(episode.id)}>
                            <RotateCcw className="size-3.5" />
                          </Button>
                        )}
                        {liveJob && (liveJob.status === "uploading" || liveJob.status === "waiting" || liveJob.status === "paused" || liveJob.status === "offline") && (
                          <Button size="icon-sm" variant="ghost" title={t.common.cancel} onClick={() => queue.cancel(episode.id)}>
                            <X className="size-3.5" />
                          </Button>
                        )}
                        {canPublish && !liveJob && episode.status === "READY_TO_PUBLISH" && (
                          <Button size="sm" onClick={() => handlePublish(episode)}>
                            <Rocket className="size-3.5" />
                            {t.movies.publish}
                          </Button>
                        )}
                        {canEdit && (
                          <Button size="icon-sm" variant="ghost" title={t.series.manage.editDetails} onClick={() => setEditMovie(episode)}>
                            <Pencil className="size-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            title={t.series.manage.deleteEpisode}
                            onClick={() => {
                              if (liveJob) void handleRemoveJob(row);
                              else setDeleteTarget(episode);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {liveJob && (liveJob.status === "uploading" || liveJob.status === "paused" || liveJob.status === "offline") && (
                      <Progress value={jobPercent} className="h-1" />
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      ))}

      {canUploadMedia && (
        <Button
          variant="outline"
          onClick={() => setExtraSeasons((prev) => [...prev, nextSeasonNumber])}
        >
          <Plus className="size-4" />
          {t.series.manage.addSeason(nextSeasonNumber)}
        </Button>
      )}

      <EditMovieDialog
        movie={editMovie}
        open={!!editMovie}
        onOpenChange={(o) => !o && setEditMovie(null)}
        onSaved={() => {
          refetchEpisodes();
          setEditMovie(null);
        }}
      />

      {/* The same two steps as for a movie — pick, then review — without
          the length, director and age rating lines a series has no place for. */}
      <TmdbMatchDialog
        open={tmdbStart !== null}
        onOpenChange={(open) => !open && setTmdbStart(null)}
        target={tmdbStart !== null ? tmdbTargetOfSeries(series, tmdbState) : null}
        start={tmdbStart ?? undefined}
        onApplied={() => {
          // The details are written; the dialog stays on its summary while
          // the card loads the show again and fills its form from it.
          reloadInfo();
          toast.success(t.tmdbPages.series.appliedToast);
        }}
        // Refused or broken off: load the show again so nothing half-done is shown.
        onApplyFailed={reloadInfo}
      />

      <ConfirmDialog
        open={statusConfirmOpen}
        onOpenChange={setStatusConfirmOpen}
        title={
          series.status === "PUBLISHED" ? t.series.unpublishConfirmTitle : t.series.publishConfirmTitle
        }
        description={
          series.status === "PUBLISHED"
            ? t.series.unpublishConfirmDescription(series.title)
            : t.series.publishConfirmDescription(series.title)
        }
        confirmLabel={series.status === "PUBLISHED" ? t.series.unpublish : t.movies.publish}
        loading={updatingStatus}
        onConfirm={handleToggleSeriesStatus}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={t.series.deleteEpisodeTitle}
        description={deleteTarget ? t.series.manage.deleteEpisodeDescription(deleteTarget.title) : ""}
        confirmLabel={t.common.delete}
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={deleteSeriesOpen}
        onOpenChange={setDeleteSeriesOpen}
        title={t.series.page.deleteTitle}
        description={t.series.page.deleteDescription}
        confirmLabel={t.common.delete}
        variant="destructive"
        loading={deletingSeries}
        onConfirm={handleDeleteSeries}
      />
    </div>
  );
}

export default function SeriesManagePage() {
  const { t } = useLanguage();
  return (
    <RequirePermission
      permission="SERIES.VIEW"
      title={t.nav.allSeries}
      description={t.series.manage.description}
    >
      <SeriesManageContent />
    </RequirePermission>
  );
}
