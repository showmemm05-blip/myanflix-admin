"use client";

import { useState, type KeyboardEvent } from "react";
import { AlertTriangle, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ChoiceChips } from "@/components/ads/ChoiceChips";
import { adErrorMessage } from "@/components/ads/adForm";
import { movieTimeText } from "@/components/ads/adWords";
import { breakPositions } from "@/components/ads/breakSchedule";
import { useLanguage } from "@/lib/context/language-context";
import type { TranslationShape } from "@/lib/i18n/translations";
import { formatMmt } from "@/lib/myanmar-time";
import { cn } from "@/lib/utils";
import { adService } from "@/services/api/adService";
import {
  AD_AUDIENCES,
  AD_SETTINGS_LIMITS,
  CORNER_FIRST_SHOW_AFTER_SECONDS,
  MIDROLL_END_GUARD_SECONDS,
  MIDROLL_INTERVAL_PRESETS,
  type AdAudience,
  type AdSettings,
} from "@/types/ad";

/** The card's element id — the page scrolls to it and focuses it for "Open Ad settings". */
export const AD_SETTINGS_CARD_ID = "ad-settings";

const INTERVAL = AD_SETTINGS_LIMITS.midrollIntervalMinutes;

/** The two lengths "What viewers will get" describes: a feature film and a typical episode. */
const PREVIEW_LENGTHS = [
  ["movie", 2 * 60 * 60],
  ["episode", 45 * 60],
] as const;

/** Break times one line lists before "and N more" (a 1-minute interval gives a film 118). */
const PREVIEW_MAX_BREAKS = 6;

/** "OFF", a preset's minutes ("15" … "60"), or "CUSTOM" ("Other…") with its own box. */
type BreakChoice = "OFF" | `${(typeof MIDROLL_INTERVAL_PRESETS)[number]}` | "CUSTOM";

/** The card's fields as typed — the number box as text, so a half-typed value is explained rather than coerced. */
interface Draft {
  adsEnabled: boolean;
  breakChoice: BreakChoice;
  customMinutes: string;
  audience: AdAudience;
}

function draftOf(settings: AdSettings): Draft {
  const minutes = settings.midrollIntervalMinutes;
  const preset = MIDROLL_INTERVAL_PRESETS.find((value) => value === minutes);
  return {
    adsEnabled: settings.adsEnabled,
    breakChoice: minutes === 0 ? "OFF" : preset ? (`${preset}` as const) : "CUSTOM",
    customMinutes: minutes === 0 ? "" : String(minutes),
    audience: settings.duringMovieAudience,
  };
}

/** A typed whole number inside [min, max], or null. */
function parseInRange(value: string, { min, max }: { min: number; max: number }): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const number = Number(value.trim());
  return number >= min && number <= max ? number : null;
}

/** The break interval the draft stands for: 0 when off, null while the "Other…" box is not a valid number. */
function intervalOf(draft: Draft): number | null {
  if (draft.breakChoice === "OFF") return 0;
  if (draft.breakChoice === "CUSTOM") return parseInRange(draft.customMinutes, INTERVAL);
  return Number(draft.breakChoice);
}

/** What one set of values gives a viewer who opens a movie now, in sentences, and what is missing to fill it. */
interface ViewerPlan {
  movie: string;
  episode: string;
  /** Only while a corner picture is live. */
  corner: string | null;
  /** Only with "Only people without Premium". */
  premium: string | null;
  /** Breaks are on but no ad plays at them — the one real misconfiguration, shown in amber on the closed card too. */
  warnBreaks: boolean;
  noPreroll: boolean;
  noCorner: boolean;
}

/**
 * "A 2-hour movie: an ad before it starts, then ad breaks at 30 min, 1 h
 * and 1 h 30 min." — the breaks fall where the players put them
 * (breakSchedule.ts, the same 120-second end guard), "an ad before it" only
 * when a pre-roll ad is live (`liveCounts`: on, with its video, inside its
 * dates), and the breaks only when an ad can fill them: the backend makes no
 * break plan without one (ad-decision.service.ts `decideOpen`), so naming the
 * times would promise ads that never come. `liveCounts` applies neither an
 * ad's chosen movies nor its hours, so this is the most a viewer can get, and
 * the card says so under it (`planNote`). An interval that is null (a
 * half-typed "Other…") gives no breaks.
 */
function viewerPlan(
  t: TranslationShape,
  values: { interval: number | null; audience: AdAudience },
  liveCounts: AdSettings["liveCounts"],
): ViewerPlan {
  const c = t.adsUi.settings;
  const before = liveCounts.preroll > 0;
  const corner = liveCounts.corner > 0;
  const line = (key: (typeof PREVIEW_LENGTHS)[number][0], seconds: number) => {
    const positions =
      values.interval && liveCounts.breaks > 0
        ? breakPositions(seconds, values.interval * 60, MIDROLL_END_GUARD_SECONDS)
        : [];
    const shown = positions.slice(0, PREVIEW_MAX_BREAKS);
    return c.planLine(
      c.lengths[key],
      before,
      shown.map((position) => movieTimeText(t, position)),
      positions.length - shown.length,
      corner,
    );
  };
  const [[movieKey, movieSeconds], [episodeKey, episodeSeconds]] = PREVIEW_LENGTHS;
  return {
    movie: line(movieKey, movieSeconds),
    episode: line(episodeKey, episodeSeconds),
    corner: corner ? c.cornerLine(movieTimeText(t, CORNER_FIRST_SHOW_AFTER_SECONDS)) : null,
    premium: values.audience === "NON_PREMIUM" ? c.premiumLine : null,
    warnBreaks: !!values.interval && liveCounts.breaks === 0,
    noPreroll: liveCounts.preroll === 0,
    noCorner: liveCounts.corner === 0,
  };
}

/** The line directly under "What viewers get": the plan is a ceiling, not a promise for every movie. */
function PlanNote({ text }: { text: string }) {
  return <p className="text-xs leading-relaxed text-muted-foreground">{text}</p>;
}

/** The amber box that says ads are off — on the closed card and inside the open one. */
function AdsOffBanner({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm text-warning">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      {text}
    </p>
  );
}

/** "Ad breaks are on, but no ad is set to play at breaks" — never hidden behind the closed card. */
function NoBreakAdsWarning({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-1.5 text-xs leading-relaxed text-warning">
      <AlertTriangle className="mt-px size-3.5 shrink-0" />
      {text}
    </p>
  );
}

interface AdSettingsCardProps {
  /** The settings as the page last read or saved them; null until the first read. */
  settings: AdSettings | null;
  error: Error | null;
  onRetry: () => void;
  /** The PUT's answer — the page keeps it, so the statuses and the wizard follow the save. */
  onSaved: (settings: AdSettings) => void;
  canManage: boolean;
  /** Open = the editor (the `Settings` board); closed = the summary. The page opens it for "Open Ad settings". */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * "Ad settings for all ads" (was "Playback rules", 2026-11-04): the master
 * switch, the break interval and who gets breaks and corner pictures.
 *
 * Closed by default: one summary sentence ("Ads are on · ad breaks every
 * 30 min · breaks and corner pictures for everyone") and what a viewer gets,
 * with "Change". The ads-off and no-break-ad warnings stay on the closed card,
 * so they are never missed. Open, it edits a draft of the three values with
 * "What viewers will get" written out for the UNSAVED values, an
 * unsaved-changes line with Undo and Save, and who changed it last (Myanmar
 * time). Closing keeps the draft; the closed card then says there are unsaved
 * changes.
 *
 * One Save PUTs the whole row (the backend audits before → after). A viewer
 * already watching keeps the break times and corner picture their player got
 * when the movie opened; but the backend asks again at every break, so ads off,
 * breaks off or "Only people without Premium" stop their remaining breaks at once.
 */
export function AdSettingsCard({ settings, error, onRetry, onSaved, canManage, open, onOpenChange }: AdSettingsCardProps) {
  const { t } = useLanguage();
  const c = t.adsUi.settings;
  const s = t.adsUi.shared;
  // Loaded-values-until-typed, like the Home settings card.
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  // A background refresh that fails keeps the settings on screen; only a
  // first read that fails has nothing to show.
  if (error && !settings) {
    return <ErrorState className="mb-6" description={c.loadError} onRetry={onRetry} />;
  }
  if (!settings) {
    return <Skeleton className="mb-6 h-32 rounded-xl" />;
  }

  const form = draft ?? draftOf(settings);
  const update = (patch: Partial<Draft>) => setDraft({ ...form, ...patch });
  const interval = intervalOf(form);
  const changed =
    form.adsEnabled !== settings.adsEnabled ||
    interval !== settings.midrollIntervalMinutes ||
    form.audience !== settings.duringMovieAudience;
  const canSave = changed && interval !== null && !saving;
  const disabled = !canManage || saving;

  const handleSave = async () => {
    if (interval === null) return;
    setSaving(true);
    try {
      const next = await adService.updateSettings({
        adsEnabled: form.adsEnabled,
        midrollIntervalMinutes: interval,
        duringMovieAudience: form.audience,
      });
      onSaved(next);
      setDraft(null);
      toast.success(c.savedToast);
    } catch (err) {
      toast.error(c.saveFailedToast, { description: adErrorMessage(err, t) });
    } finally {
      setSaving(false);
    }
  };
  const saveOnEnter = (e: KeyboardEvent) => {
    if (e.key === "Enter" && canSave) void handleSave();
  };

  const cardProps = {
    id: AD_SETTINGS_CARD_ID,
    // Focusable only from code ("Open Ad settings" moves focus here), so a
    // screen reader lands on the card it was sent to.
    tabIndex: -1,
    role: "region",
    "aria-labelledby": `${AD_SETTINGS_CARD_ID}-title`,
    className: "glass-card mb-6 scroll-mt-24 outline-none focus-visible:ring-2 focus-visible:ring-ring",
  };

  if (!open) {
    const saved = viewerPlan(
      t,
      { interval: settings.midrollIntervalMinutes, audience: settings.duringMovieAudience },
      settings.liveCounts,
    );
    const breakEvery =
      settings.midrollIntervalMinutes > 0 ? movieTimeText(t, settings.midrollIntervalMinutes * 60) : null;
    return (
      <Card {...cardProps}>
        <CardHeader>
          <CardTitle id={`${AD_SETTINGS_CARD_ID}-title`} role="heading" aria-level={2} className="font-semibold">
            {c.title}
          </CardTitle>
          <CardAction>
            <Button variant="outline" aria-expanded={false} onClick={() => onOpenChange(true)}>
              {canManage ? s.change : c.view}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="flex items-start gap-2 text-sm">
            <span
              aria-hidden
              className={cn(
                "mt-1.5 size-2 shrink-0 rounded-full",
                settings.adsEnabled ? "bg-success" : "bg-muted-foreground",
              )}
            />
            {settings.adsEnabled
              ? c.summaryOn(breakEvery, settings.duringMovieAudience === "ALL")
              : c.summaryOff}
          </p>
          {settings.adsEnabled && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">{c.whatViewersGet}</span> {saved.movie}
              {saved.corner && <> {saved.corner}</>}
            </p>
          )}
          {settings.adsEnabled && <PlanNote text={c.planNote} />}
          {settings.adsEnabled && saved.warnBreaks && <NoBreakAdsWarning text={c.warnNoBreakAds} />}
          {changed && <p className="text-xs text-warning">{c.unsaved}</p>}
          {!settings.adsEnabled && <AdsOffBanner text={c.offBanner} />}
        </CardContent>
      </Card>
    );
  }

  const plan = viewerPlan(t, { interval, audience: form.audience }, settings.liveCounts);
  const breakOptions = [
    { value: "OFF" as const, label: c.breakOff },
    ...MIDROLL_INTERVAL_PRESETS.map((minutes) => ({
      value: `${minutes}` as const,
      label: c.breakEvery(movieTimeText(t, minutes * 60)),
    })),
    { value: "CUSTOM" as const, label: c.breakOther },
  ];
  const audienceOptions = AD_AUDIENCES.map((value) => ({ value, label: c.audienceOptions[value] }));
  const who = settings.updatedBy ? settings.updatedBy.displayName || settings.updatedBy.username : t.common.unknownUser;

  return (
    <Card {...cardProps}>
      <CardHeader>
        <CardTitle id={`${AD_SETTINGS_CARD_ID}-title`} role="heading" aria-level={2} className="font-semibold">
          {c.title}
        </CardTitle>
        <CardDescription>{c.description}</CardDescription>
        <CardAction>
          <Button variant="ghost" aria-expanded onClick={() => onOpenChange(false)}>
            {c.hide}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--border-strong)] p-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="ad-settings-enabled">{c.enabledLabel}</Label>
            <p className="text-xs leading-relaxed text-muted-foreground">{c.enabledHint}</p>
          </div>
          <Switch
            id="ad-settings-enabled"
            checked={form.adsEnabled}
            disabled={disabled}
            onCheckedChange={(checked) => update({ adsEnabled: checked })}
          />
        </div>
        {!form.adsEnabled && <AdsOffBanner text={c.offBanner} />}

        {/* Greyed while ads are off, but still editable: the settings are kept for when they come back on. */}
        <div className={cn("grid gap-5 transition-opacity lg:grid-cols-2", !form.adsEnabled && "opacity-60")}>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label>{c.breaksLabel}</Label>
            <ChoiceChips
              options={breakOptions}
              value={form.breakChoice}
              label={c.breaksLabel}
              disabled={disabled}
              onChange={(breakChoice) => update({ breakChoice })}
            />
            {form.breakChoice === "CUSTOM" && (
              <div className="flex items-center gap-2">
                <Input
                  id="ad-settings-break-other"
                  type="number"
                  inputMode="numeric"
                  min={INTERVAL.min}
                  max={INTERVAL.max}
                  step={1}
                  className="w-28"
                  value={form.customMinutes}
                  disabled={disabled}
                  aria-label={c.breakOtherLabel}
                  aria-invalid={interval === null}
                  onChange={(e) => update({ customMinutes: e.target.value })}
                  onKeyDown={saveOnEnter}
                />
                <span className="text-sm text-muted-foreground">{c.breakOtherUnit}</span>
              </div>
            )}
            <p
              className={cn(
                "text-xs leading-relaxed",
                interval === null ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {interval === null ? c.breakOtherInvalid(INTERVAL.min, INTERVAL.max) : c.breaksHint}
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <Label>{c.audienceLabel}</Label>
            <ChoiceChips
              options={audienceOptions}
              value={form.audience}
              label={c.audienceLabel}
              disabled={disabled}
              onChange={(audience) => update({ audience })}
            />
            <p className="text-xs leading-relaxed text-muted-foreground">{c.audienceNote}</p>
          </div>
        </div>

        <section
          aria-labelledby="ad-settings-preview"
          className="flex flex-col gap-2 rounded-lg border border-[var(--border-strong)] bg-secondary/30 p-4"
        >
          <h3 id="ad-settings-preview" className="text-sm font-semibold">
            {c.previewHeading}
          </h3>
          {form.adsEnabled ? (
            <>
              <ul className="flex flex-col gap-1 text-sm leading-relaxed">
                <li>{plan.movie}</li>
                <li>{plan.episode}</li>
                {plan.corner && <li>{plan.corner}</li>}
                {plan.premium && <li>{plan.premium}</li>}
              </ul>
              <PlanNote text={c.planNote} />
              {plan.warnBreaks && <NoBreakAdsWarning text={c.warnNoBreakAds} />}
              {plan.noPreroll && (
                <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                  <Info className="mt-px size-3.5 shrink-0" />
                  {c.warnNoPreroll}
                </p>
              )}
              {plan.noCorner && (
                <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                  <Info className="mt-px size-3.5 shrink-0" />
                  {c.warnNoCorner}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm">{c.adsOffPreview}</p>
          )}
          <p className="border-t pt-2 text-xs leading-relaxed text-muted-foreground">{c.appliesNote}</p>
        </section>

        {canManage ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-sm text-warning" aria-live="polite">
              {changed && c.unsaved}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" disabled={!changed || saving} onClick={() => setDraft(null)}>
                {c.undo}
              </Button>
              <Button onClick={handleSave} disabled={!canSave}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                {c.save}
              </Button>
            </div>
          </div>
        ) : (
          <p className="border-t pt-4 text-sm text-muted-foreground">{c.readOnly}</p>
        )}
        <p className="-mt-2 text-xs text-muted-foreground">
          {settings.updatedAt ? c.lastChanged(who, formatMmt(settings.updatedAt)) : c.neverChanged}
        </p>
      </CardContent>
    </Card>
  );
}
