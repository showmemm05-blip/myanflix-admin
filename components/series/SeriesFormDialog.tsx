"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";
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
import { ActorPicker } from "@/components/actors/ActorPicker";
import {
  DESCRIPTION_MAX_LENGTH,
  DescriptionLanguageSection,
  descriptionProblem,
  isDescriptionRequiredError,
} from "@/components/shared/DescriptionLanguageSection";
import { MediaTypeSelect } from "@/components/shared/MediaTypeSelect";
import { TmdbPickDialog } from "@/components/tmdb/TmdbPickDialog";
import { TmdbResultSummary } from "@/components/tmdb/TmdbResultSummary";
import { tmdbErrorCode, tmdbErrorMessage } from "@/components/tmdb/tmdbWords";
import { seriesService } from "@/services/api/seriesService";
import { tmdbService } from "@/services/api/tmdbService";
import { GENRE_OPTIONS, LANGUAGES } from "@/lib/constants/movie-options";
import { parseRatingInput, ratingToInput } from "@/lib/rating";
import { useTmdbConnection } from "@/lib/hooks/use-tmdb-states";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import type { Series } from "@/types/series";
import type { TmdbSearchResult } from "@/types/tmdb";
import { toast } from "sonner";

interface SeriesFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; absent when creating. */
  series?: Series | null;
  onSaved: (series: Series) => void;
  /**
   * A new show was created from a TMDB entry ("Find on TMDB"): a draft with
   * its details, pictures and cast already filled in. The page opens its
   * manage page, ready for episodes. Left out, `onSaved` is called instead.
   */
  onCreatedFromTmdb?: (series: Series) => void;
}

interface SeriesFormProps extends Omit<SeriesFormDialogProps, "open"> {
  /** True while the series is being created from TMDB: the dialog must not be closed under the request. */
  onCreatingChange: (creating: boolean) => void;
}

/** One of our series that is already linked to the TMDB entry staff picked. `id` is null when it could not be named. */
interface ExistingSeries {
  id: string | null;
  title: string;
}

function SeriesForm({ series, onOpenChange, onSaved, onCreatedFromTmdb, onCreatingChange }: SeriesFormProps) {
  const { t } = useLanguage();
  const { can } = useRole();
  const [title, setTitle] = useState(series?.title ?? "");
  const [description, setDescription] = useState(series?.description ?? "");
  // `?? ""`: a backend from before the Burmese description leaves the field out.
  const [descriptionMm, setDescriptionMm] = useState(series?.descriptionMm ?? "");
  const [genre, setGenre] = useState(series?.genre ?? "");
  const [language, setLanguage] = useState(series?.language ?? "English");
  const [country, setCountry] = useState<string | null>(series?.country ?? null);
  const [releaseYear, setReleaseYear] = useState(String(series?.releaseYear ?? new Date().getFullYear()));
  const [rating, setRating] = useState(ratingToInput(series?.rating));
  const [accessType, setAccessType] = useState<Series["accessType"]>(series?.accessType ?? "SUBSCRIPTION");
  // Seeded from the stored cast: PUT `set`s the whole list, so sending an
  // empty array while editing would wipe the actors already on the show.
  const [actorIds, setActorIds] = useState<string[]>((series?.actors ?? []).map((a) => a.id));
  const [saving, setSaving] = useState(false);

  // ---- Find on TMDB (a new show only; an existing one uses its manage page) ----
  // Creating from TMDB saves pictures, so it needs MEDIA.UPLOAD on top of
  // SERIES.CREATE, and the search for the show is a SERIES.EDIT route. The
  // button hides when the server itself said TMDB is not connected, and
  // waits for that answer so it never shows and then goes; a member who may
  // not ask (the status needs MOVIES.VIEW) keeps it and the search explains.
  const canFindOnTmdb = !series && can("SERIES.CREATE") && can("SERIES.EDIT") && can("MEDIA.UPLOAD");
  const connection = useTmdbConnection({ enabled: canFindOnTmdb && can("MOVIES.VIEW") });
  const connectionAnswered = !(connection.isLoading && connection.status === null);
  const findShown = canFindOnTmdb && connectionAnswered && !connection.notConnected;
  const [pickOpen, setPickOpen] = useState(false);
  /** The TMDB show staff picked, waiting for "Create series". */
  const [candidate, setCandidate] = useState<TmdbSearchResult | null>(null);
  const [existing, setExisting] = useState<ExistingSeries | null>(null);
  const [creating, setCreating] = useState(false);

  const openPick = () => {
    setCandidate(null);
    setExisting(null);
    setPickOpen(true);
  };

  const handlePicked = (result: TmdbSearchResult) => {
    setPickOpen(false);
    // One of our series is already linked to this show: say so instead of
    // offering to create it twice.
    if (result.usedBy) setExisting({ id: result.usedBy.id, title: result.usedBy.title });
    else setCandidate(result);
  };

  const handleCreateFromTmdb = async () => {
    if (!candidate) return;
    setCreating(true);
    onCreatingChange(true);
    try {
      const { series: created } = await tmdbService.createSeries(candidate.tmdbId);
      toast.success(t.tmdbPages.series.createdToast, {
        description: t.tmdbPages.series.createdDescription(created.title),
      });
      onCreatingChange(false);
      onOpenChange(false);
      (onCreatedFromTmdb ?? onSaved)(created);
    } catch (err) {
      if (tmdbErrorCode(err) === "TMDB_SERIES_EXISTS") {
        // Someone created it between the search and this click. The refusal
        // does not name the series to the client, so the search is asked
        // once more for it.
        const usedBy = await tmdbService
          .findSeriesUsing(candidate.tmdbId, candidate.title, candidate.year)
          .catch(() => null);
        setExisting({ id: usedBy?.id ?? null, title: usedBy?.title ?? candidate.title });
        setCandidate(null);
      } else {
        toast.error(t.tmdbPages.series.createFailedToast, { description: tmdbErrorMessage(err, t) });
      }
      onCreatingChange(false);
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async () => {
    // What is missing is asked for by name, one thing at a time.
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
    setSaving(true);
    try {
      const values = {
        title: title.trim(),
        description: description.trim(),
        // "" clears the Burmese text on an edit; a new show just has none.
        ...(series || descriptionMm.trim() ? { descriptionMm: descriptionMm.trim() } : {}),
        genre,
        language,
        country: country ?? "",
        releaseYear: Number(releaseYear) || new Date().getFullYear(),
        rating: ratingValue,
        accessType,
        actorIds,
      };
      const saved = series
        ? await seriesService.updateSeries(series.id, values)
        : await seriesService.createSeries(values);
      onSaved(saved);
      toast.success(series ? t.series.updatedToast : t.series.createdToast, { description: t.movies.editDialog.updatedDescription(saved.title) });
      onOpenChange(false);
    } catch (err) {
      if (isDescriptionRequiredError(err)) toast.error(t.tmdbPages.series.descriptionRequired);
      else toast.error(t.series.saveFailedToast, { description: t.movies.pleaseTryAgain });
    } finally {
      setSaving(false);
    }
  };

  // A word outside the list stays choosable, so editing never loses it.
  const languageOptions =
    series?.language && !LANGUAGES.includes(series.language) ? [...LANGUAGES, series.language] : LANGUAGES;
  // While a TMDB show is on the table the hand-typed fields step aside.
  const byHand = !candidate && !existing;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{series ? t.series.form.editTitle : t.series.form.createTitle}</DialogTitle>
        <DialogDescription>
          {series ? t.series.form.editDescriptionFor(series.title) : t.series.form.createDescription}
        </DialogDescription>
      </DialogHeader>

      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1.5">
              <Label htmlFor="series-title">{t.tmdbPages.series.nameLabel}</Label>
              <Input
                id="series-title"
                value={title}
                disabled={creating}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            {findShown && (
              <Button
                type="button"
                variant="outline"
                disabled={!title.trim() || saving || creating}
                onClick={openPick}
              >
                <Search className="size-4" />
                {t.tmdbPages.series.findOnTmdb}
              </Button>
            )}
          </div>
          {findShown && <p className="text-xs text-muted-foreground">{t.tmdbPages.series.findHint}</p>}
        </div>

        {existing && (
          <section
            aria-labelledby="series-tmdb-exists"
            className="flex flex-col gap-3 rounded-lg border border-warning/25 bg-warning/10 p-3"
          >
            <div className="flex flex-col gap-1">
              <p id="series-tmdb-exists" className="text-sm font-semibold">
                {t.tmdbPages.series.existsTitle}
              </p>
              <p className="text-sm [overflow-wrap:anywhere]">{t.tmdbPages.series.existsText(existing.title)}</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={openPick}>
                {t.tmdbPages.series.pickAnother}
              </Button>
              {existing.id && (
                <Button
                  size="sm"
                  render={<Link href={`/series/${existing.id}`} />}
                  nativeButton={false}
                  onClick={() => onOpenChange(false)}
                >
                  {t.tmdbPages.series.openIt}
                </Button>
              )}
            </div>
          </section>
        )}

        {candidate && (
          <section
            aria-labelledby="series-tmdb-confirm"
            className="flex flex-col gap-3 rounded-lg border border-success/25 bg-success/10 p-3"
          >
            <p id="series-tmdb-confirm" className="text-sm font-semibold">
              {t.tmdbPages.series.confirmTitle}
            </p>
            <TmdbResultSummary result={candidate} />
            <p className="text-sm leading-relaxed">{t.tmdbPages.series.confirmText}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" size="sm" disabled={creating} onClick={openPick}>
                {t.tmdbPages.series.pickAnother}
              </Button>
              <Button type="button" size="sm" disabled={creating} onClick={handleCreateFromTmdb}>
                {creating && <Loader2 className="size-3.5 animate-spin" />}
                {creating ? t.tmdbPages.series.creating : t.tmdbPages.series.create}
              </Button>
            </div>
          </section>
        )}

        {byHand && (
          <>
            <DescriptionLanguageSection
              idPrefix="series-form"
              english={description}
              burmese={descriptionMm}
              onEnglishChange={setDescription}
              onBurmeseChange={setDescriptionMm}
              disabled={saving}
            />
            {/* Two columns, not three: the dialog is max-w-lg and rating makes four fields. */}
            <div className="grid grid-cols-2 gap-3">
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
            <MediaTypeSelect kind="series" value={country} onChange={setCountry} />
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
            <ActorPicker value={actorIds} onChange={setActorIds} disabled={saving} hint={t.actors.picker.seriesHint} />
          </>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || creating}>
          {t.common.cancel}
        </Button>
        {byHand && (
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {series ? t.movies.editDialog.saveChanges : t.series.form.createSeriesButton}
          </Button>
        )}
      </DialogFooter>

      {/* Inside this dialog, so the list opens on top of it. Cancel there
          comes back to the form as it was, for typing by hand. */}
      {findShown && (
        <TmdbPickDialog
          open={pickOpen}
          onOpenChange={setPickOpen}
          kind="series"
          initialQuery={title.trim()}
          onPicked={handlePicked}
        />
      )}
    </>
  );
}

/**
 * The Create / Edit Series dialog. A new show can be typed by hand as
 * always, or — since 2026-11-06 (docs/movie-details-tmdb-2026-11-06, the
 * `SeriesCreate` board) — found on TMDB: "Find on TMDB" opens the list for
 * the typed name, the chosen show is confirmed, and the series is created
 * from it as a draft with its details, poster, banner and cast. A show we
 * already have says so, with "Open it". The button is absent while TMDB is
 * not connected.
 *
 * The single description box became "Description in each language"; the
 * form asks for one of the two.
 */
export function SeriesFormDialog({ open, onOpenChange, series, onSaved, onCreatedFromTmdb }: SeriesFormDialogProps) {
  // Creating from TMDB takes a few seconds (pictures and cast are saved):
  // closing under it would lose the answer, and with it the new show's page.
  const [creating, setCreating] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && creating) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg" showCloseButton={!creating}>
        {open && (
          <SeriesForm
            key={series?.id ?? "new"}
            series={series}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
            onCreatedFromTmdb={onCreatedFromTmdb}
            onCreatingChange={setCreating}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
