"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PromoArt } from "@/components/home-promos/PromoArt";
import { PromoPreview } from "@/components/home-promos/PromoPreview";
import { TitleTargetPicker } from "@/components/home-promos/TitleTargetPicker";
import {
  changedFields,
  emptyForm,
  formFromPromo,
  formProblems,
  promoErrorMessage,
  showsCtaLabel,
  showsDateText,
  toFields,
  type PromoFormState,
} from "@/components/home-promos/promoForm";
import { useLanguage } from "@/lib/context/language-context";
import { useObjectUrl } from "@/lib/hooks/use-object-url";
import { cn } from "@/lib/utils";
import { ApiError } from "@/services/api/apiClient";
import { homePromoService } from "@/services/api/homePromoService";
import { uploadService } from "@/services/api/uploadService";
import {
  HOME_PROMO_ART_PRESETS,
  HOME_PROMO_CTA_TARGETS,
  HOME_PROMO_KINDS,
  HOME_PROMO_LIMITS,
  HOME_PROMO_TITLE_TARGETS,
  isTitleTarget,
  type HomePromo,
  type HomePromoCtaTarget,
  type HomePromoKind,
} from "@/types/home-promo";

interface PromoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The promo being edited, or null to create one. */
  promo: HomePromo | null;
  /** The kind a new promo starts on (the tab the admin is looking at). */
  defaultKind: HomePromoKind;
  /** Kinds already holding the maximum — offered but disabled on create. */
  fullKinds: HomePromoKind[];
  onSaved: (promo: HomePromo) => void;
  /** Called when the backend says the promo is gone — the page reloads its list. */
  onStale: () => void;
}

/**
 * Create / edit one promo. The parent mounts it with a `key` per promo, so
 * the form state is seeded once from props and never synced in an effect.
 */
export function PromoFormDialog({
  open,
  onOpenChange,
  promo,
  defaultKind,
  fullKinds,
  onSaved,
  onStale,
}: PromoFormDialogProps) {
  const { t } = useLanguage();
  const f = t.homePromos.form;
  const [state, setState] = useState<PromoFormState>(() =>
    promo ? formFromPromo(promo) : emptyForm(defaultKind),
  );
  const [previewLang, setPreviewLang] = useState<"en" | "mm">("en");
  const [saving, setSaving] = useState(false);
  const [showProblems, setShowProblems] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrl = useObjectUrl(state.imageFile);
  const imagePreview = objectUrl ?? state.imageUrl;

  const set = <K extends keyof PromoFormState>(key: K, value: PromoFormState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const problems = formProblems(state, t);
  const isEdit = !!promo;
  const kind = state.kind;

  const ctaChoices: readonly HomePromoCtaTarget[] =
    kind === "SPOTLIGHT" ? HOME_PROMO_TITLE_TARGETS : HOME_PROMO_CTA_TARGETS;
  const ctaItems = Object.fromEntries(ctaChoices.map((value) => [value, f.ctaTargetOptions[value]]));
  const kindItems = Object.fromEntries(HOME_PROMO_KINDS.map((value) => [value, t.homePromos.kindSingular[value]]));
  const artItems = Object.fromEntries(HOME_PROMO_ART_PRESETS.map((value) => [value, f.artPresets[value]]));

  const changeKind = (next: HomePromoKind) =>
    setState((prev) => ({
      ...prev,
      kind: next,
      // A spotlight can only open a title; anything else falls back to a movie.
      ctaTarget: next === "SPOTLIGHT" && !isTitleTarget(prev.ctaTarget) ? "MOVIE" : prev.ctaTarget,
    }));

  const changeCtaTarget = (next: HomePromoCtaTarget) =>
    setState((prev) => ({
      ...prev,
      ctaTarget: next,
      // A movie id is not a series id — a new title type starts unpicked.
      target: next === prev.ctaTarget ? prev.target : null,
    }));

  const handleSave = async () => {
    if (problems.length > 0) {
      setShowProblems(true);
      return;
    }
    setSaving(true);
    try {
      let imageUrl = state.imageUrl;
      const file = state.imageFile;
      if (file) {
        imageUrl = (await uploadService.uploadImage(file, "promo")).url;
        // Keep the uploaded copy as the promo's image right away: if the save
        // below is refused, the next Save reuses it instead of uploading the
        // same picture again (which would leave an unused copy in images/promo/).
        const uploaded = imageUrl;
        setState((prev) => (prev.imageFile === file ? { ...prev, imageFile: null, imageUrl: uploaded } : prev));
      }
      const fields = toFields(state, imageUrl);
      let saved: HomePromo;
      if (promo) {
        const changed = changedFields(promo, fields);
        saved = Object.keys(changed).length > 0 ? await homePromoService.updatePromo(promo.id, changed) : promo;
        toast.success(t.homePromos.updatedToast);
      } else {
        saved = await homePromoService.createPromo({ ...fields, kind: state.kind });
        toast.success(t.homePromos.createdToast);
      }
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      toast.error(t.homePromos.saveFailedToast, { description: promoErrorMessage(err, t) });
      if (err instanceof ApiError && err.code === "HOME_PROMO_NOT_FOUND") {
        onStale();
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  };

  /** One English + Burmese pair of inputs. */
  const pair = (
    label: string,
    enKey: "titleEn" | "kickerEn" | "bodyEn" | "ctaLabelEn",
    mmKey: "titleMm" | "kickerMm" | "bodyMm" | "ctaLabelMm",
    max: number,
    options: { multiline?: boolean; optional?: boolean } = {},
  ) => (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label}
        {options.optional && <span className="font-normal text-muted-foreground"> · {f.optional}</span>}
      </Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {([
          [enKey, f.english],
          [mmKey, f.burmese],
        ] as const).map(([key, language]) => {
          const value = state[key];
          const common = {
            value,
            maxLength: max,
            disabled: saving,
            "aria-label": `${label} (${language})`,
            placeholder: language,
          };
          return (
            <div key={key} className="flex flex-col gap-1">
              {options.multiline ? (
                <Textarea rows={3} {...common} onChange={(e) => set(key, e.target.value)} />
              ) : (
                <Input {...common} onChange={(e) => set(key, e.target.value)} />
              )}
              <span className="self-end text-[10px] tabular-nums text-muted-foreground">
                {value.length}/{max}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const previewText = (en: string, mm: string) => (previewLang === "en" ? en : mm).trim();

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? f.editTitle : f.createTitle}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* ------------------------------------------------ the form */}
          <div className="flex min-w-0 flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label>{f.whereLabel}</Label>
              {isEdit ? (
                <p className="text-sm">
                  <span className="font-medium">{t.homePromos.kindSingular[kind]}</span>
                  <span className="text-muted-foreground"> · {f.kindLocked}</span>
                </p>
              ) : (
                <Select items={kindItems} value={kind} onValueChange={(v) => v && changeKind(v as HomePromoKind)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOME_PROMO_KINDS.map((value) => (
                      <SelectItem key={value} value={value} disabled={fullKinds.includes(value)}>
                        {t.homePromos.kindSingular[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">{t.homePromos.kindHelp[kind]}</p>
            </div>

            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">{f.textsHeading}</h3>
              {pair(f.titleLabel, "titleEn", "titleMm", HOME_PROMO_LIMITS.title)}
              {pair(f.kickerLabel, "kickerEn", "kickerMm", HOME_PROMO_LIMITS.kicker, { optional: true })}
              {pair(f.bodyLabel, "bodyEn", "bodyMm", HOME_PROMO_LIMITS.body, { multiline: true, optional: true })}
              <p className="text-xs text-muted-foreground">{f.pairHint}</p>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">{f.buttonHeading}</h3>
              <div className="flex flex-col gap-1.5">
                <Label>{f.ctaTargetLabel}</Label>
                <Select
                  items={ctaItems}
                  value={state.ctaTarget}
                  onValueChange={(v) => v && changeCtaTarget(v as HomePromoCtaTarget)}
                >
                  <SelectTrigger className="w-full" disabled={saving}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ctaChoices.map((value) => (
                      <SelectItem key={value} value={value}>
                        {f.ctaTargetOptions[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {kind === "SPOTLIGHT" && (
                  <p className="text-xs text-muted-foreground">{f.spotlightTargetHint}</p>
                )}
              </div>

              {isTitleTarget(state.ctaTarget) && (
                <div className="flex flex-col gap-1.5">
                  <Label>{f.targetLabel[state.ctaTarget]}</Label>
                  <TitleTargetPicker
                    key={state.ctaTarget}
                    type={state.ctaTarget}
                    value={state.target}
                    onChange={(title) => set("target", title)}
                    disabled={saving}
                    invalid={showProblems && !state.target}
                  />
                  {state.ctaTarget === "BOOK" && (
                    <p className="text-xs text-muted-foreground">{t.homePromos.bookSignedInOnly}</p>
                  )}
                </div>
              )}

              {state.ctaTarget === "URL" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="promo-url">{f.urlLabel}</Label>
                  <Input
                    id="promo-url"
                    type="url"
                    inputMode="url"
                    placeholder="https://"
                    value={state.url}
                    maxLength={HOME_PROMO_LIMITS.url}
                    disabled={saving}
                    onChange={(e) => set("url", e.target.value)}
                  />
                </div>
              )}

              {showsCtaLabel(kind, state.ctaTarget) &&
                pair(f.ctaLabelLabel, "ctaLabelEn", "ctaLabelMm", HOME_PROMO_LIMITS.ctaLabel, {
                  optional: kind !== "HERO",
                })}
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">{f.artHeading}</h3>
              <div className="flex flex-col gap-1.5">
                <Label>{f.artPresetLabel}</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {HOME_PROMO_ART_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      aria-pressed={state.artPreset === preset}
                      disabled={saving}
                      onClick={() => set("artPreset", preset)}
                      className={cn(
                        "flex flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors disabled:opacity-50",
                        state.artPreset === preset
                          ? "border-ring ring-2 ring-ring"
                          : "border-[var(--border-strong)] hover:bg-muted",
                      )}
                    >
                      <span className="relative block aspect-video overflow-hidden rounded">
                        <PromoArt preset={preset} />
                      </span>
                      <span className="truncate text-[11px] font-medium">{artItems[preset]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) set("imageFile", file);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => fileRef.current?.click()}
                >
                  <ImageIcon className="size-3.5" />
                  {imagePreview ? f.replaceImage : f.uploadImage}
                </Button>
                {imagePreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={() => setState((prev) => ({ ...prev, imageFile: null, imageUrl: null }))}
                  >
                    <Trash2 className="size-3.5" />
                    {f.removeImage}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {f.imageHint}
                {kind === "SPOTLIGHT" && <> {f.spotlightImageHint}</>}
              </p>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">{f.scheduleHeading}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ["startsAt", f.startsAtLabel],
                  ["endsAt", f.endsAtLabel],
                ] as const).map(([key, label]) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <Label htmlFor={`promo-${key}`}>{label}</Label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        id={`promo-${key}`}
                        type="datetime-local"
                        value={state[key]}
                        disabled={saving}
                        onChange={(e) => set(key, e.target.value)}
                      />
                      {state[key] && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={saving}
                          onClick={() => set(key, "")}
                        >
                          {f.clearDate}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{f.scheduleHint}</p>

              {showsDateText(kind) && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="promo-date-text">{f.dateTextLabel}</Label>
                  <Input
                    id="promo-date-text"
                    value={state.dateText}
                    maxLength={HOME_PROMO_LIMITS.dateText}
                    disabled={saving}
                    onChange={(e) => set("dateText", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{f.dateTextHint}</p>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-strong)] p-3">
                <div>
                  <Label htmlFor="promo-active">{f.activeLabel}</Label>
                  <p className="text-xs text-muted-foreground">{f.activeHint}</p>
                </div>
                <Switch
                  id="promo-active"
                  checked={state.isActive}
                  disabled={saving}
                  onCheckedChange={(checked) => set("isActive", checked)}
                />
              </div>
            </section>
          </div>

          {/* --------------------------------------------- the preview */}
          <aside className="flex flex-col gap-2 lg:sticky lg:top-0 lg:self-start">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{f.previewLabel}</p>
              <div className="flex rounded-md bg-muted p-0.5" role="group" aria-label={f.previewLabel}>
                {(["en", "mm"] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    aria-pressed={previewLang === lang}
                    onClick={() => setPreviewLang(lang)}
                    className={cn(
                      "rounded px-2 py-0.5 text-xs font-medium",
                      previewLang === lang ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                    )}
                  >
                    {lang === "en" ? f.english : f.burmese}
                  </button>
                ))}
              </div>
            </div>
            <PromoPreview
              kind={kind}
              artPreset={state.artPreset}
              imageUrl={imagePreview}
              fallbackImageUrl={state.target?.imageUrl ?? null}
              kicker={previewText(state.kickerEn, state.kickerMm)}
              title={previewText(state.titleEn, state.titleMm)}
              body={previewText(state.bodyEn, state.bodyMm)}
              ctaLabel={previewText(state.ctaLabelEn, state.ctaLabelMm)}
              ctaTarget={state.ctaTarget}
              dateText={state.dateText.trim()}
            />
            {showProblems && problems.length > 0 && (
              <ul className="flex flex-col gap-1 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
          </aside>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t.common.cancel}
          </Button>
          <Button onClick={handleSave} disabled={saving || (showProblems && problems.length > 0)}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving && state.imageFile ? f.uploadingImage : isEdit ? t.common.save : t.common.add}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
