"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { isHttpUrl, promoErrorMessage } from "@/components/home-promos/promoForm";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { ApiError } from "@/services/api/apiClient";
import { homePromoService } from "@/services/api/homePromoService";
import { HOME_PROMO_LIMITS, type HomeSettings } from "@/types/home-promo";

type LinkKey = "webUrl" | "appStoreUrl" | "playStoreUrl";

interface Draft {
  webUrl: string;
  appStoreUrl: string;
  playStoreUrl: string;
  gamesTeaserEnabled: boolean;
  gamesTeaserDateText: string;
}

function draftOf(settings: HomeSettings): Draft {
  return {
    webUrl: settings.webUrl ?? "",
    appStoreUrl: settings.appStoreUrl ?? "",
    playStoreUrl: settings.playStoreUrl ?? "",
    gamesTeaserEnabled: settings.gamesTeaserEnabled,
    gamesTeaserDateText: settings.gamesTeaserDateText ?? "",
  };
}

const orNull = (value: string) => (value.trim() === "" ? null : value.trim());

/**
 * The single home settings row: the web address (phone app's "Also on the
 * web" card), the two store links (website's "Watch on your phone" card)
 * and the games teaser in the Coming soon strip. PUT replaces the whole row,
 * so every save sends every field.
 */
export function HomeSettingsCard({ canManage }: { canManage: boolean }) {
  const { t } = useLanguage();
  const s = t.homePromos.settings;
  const { data, isLoading, error, refetch } = useAsyncData(() => homePromoService.getSettings(), []);

  // Loaded-value-until-typed, like the Peak users card: a save replaces
  // the loaded view without a refetch and clears the draft.
  const [saved, setSaved] = useState<HomeSettings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const view = saved ?? data;
  const current = draft ?? (view ? draftOf(view) : null);

  if (error) {
    return <ErrorState description={s.loadError} onRetry={refetch} />;
  }
  if (isLoading || !view || !current) {
    return <Skeleton className="h-96 rounded-lg" />;
  }

  const linkError = (key: LinkKey) => {
    const value = current[key].trim();
    if (!value) return null;
    if (value.length > HOME_PROMO_LIMITS.url) return s.tooLong(HOME_PROMO_LIMITS.url);
    return isHttpUrl(value) ? null : s.urlInvalid;
  };
  const dateTooLong = current.gamesTeaserDateText.trim().length > HOME_PROMO_LIMITS.dateText;
  const hasErrors =
    (["webUrl", "appStoreUrl", "playStoreUrl"] as const).some((key) => linkError(key)) || dateTooLong;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(draftOf(view));

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft({ ...current, [key]: value });

  const handleSave = async () => {
    if (hasErrors) return;
    setSaving(true);
    try {
      const next = await homePromoService.updateSettings({
        webUrl: orNull(current.webUrl),
        appStoreUrl: orNull(current.appStoreUrl),
        playStoreUrl: orNull(current.playStoreUrl),
        gamesTeaserEnabled: current.gamesTeaserEnabled,
        gamesTeaserDateText: orNull(current.gamesTeaserDateText),
      });
      setSaved(next);
      setDraft(null);
      toast.success(s.savedToast);
    } catch (err) {
      // A 400 here is the DTO refusing a field (English text, no code) — say
      // it in the admin's language; anything else goes through the shared helper.
      toast.error(s.saveFailedToast, {
        description:
          err instanceof ApiError && err.status === 400 && !err.code ? s.rejected : promoErrorMessage(err, t),
      });
    } finally {
      setSaving(false);
    }
  };

  const linkField = (key: LinkKey, label: string, hint?: string) => {
    const message = linkError(key);
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`home-settings-${key}`}>{label}</Label>
        <Input
          id={`home-settings-${key}`}
          type="url"
          inputMode="url"
          placeholder="https://"
          value={current[key]}
          maxLength={HOME_PROMO_LIMITS.url}
          disabled={!canManage || saving}
          aria-invalid={!!message}
          onChange={(e) => update(key, e.target.value)}
        />
        {message ? (
          <p className="text-xs text-destructive">{message}</p>
        ) : (
          hint && <p className="text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
    );
  };

  const who = view.updatedBy ? view.updatedBy.displayName || view.updatedBy.username : t.common.unknownUser;

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>{s.title}</CardTitle>
        <CardDescription>{s.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {linkField("webUrl", s.webUrlLabel, s.webUrlHint)}
        <Separator />
        {linkField("appStoreUrl", s.appStoreUrlLabel)}
        {linkField("playStoreUrl", s.playStoreUrlLabel)}
        <p className="-mt-2 text-xs text-muted-foreground">{s.storeHint}</p>
        <Separator />
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label htmlFor="home-settings-games">{s.gamesEnabledLabel}</Label>
            <p className="text-xs text-muted-foreground">{s.gamesEnabledHint}</p>
          </div>
          <Switch
            id="home-settings-games"
            checked={current.gamesTeaserEnabled}
            disabled={!canManage || saving}
            onCheckedChange={(checked) => update("gamesTeaserEnabled", checked)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="home-settings-games-date">{s.gamesDateLabel}</Label>
          <Input
            id="home-settings-games-date"
            value={current.gamesTeaserDateText}
            maxLength={HOME_PROMO_LIMITS.dateText}
            disabled={!canManage || saving || !current.gamesTeaserEnabled}
            aria-invalid={dateTooLong}
            onChange={(e) => update("gamesTeaserDateText", e.target.value)}
          />
          <p className={dateTooLong ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {dateTooLong ? s.tooLong(HOME_PROMO_LIMITS.dateText) : s.gamesDateHint}
          </p>
        </div>
        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {view.updatedAt
              ? s.lastChanged(who, format(new Date(view.updatedAt), "d MMM yyyy, HH:mm"))
              : s.neverChanged}
          </p>
          {canManage ? (
            <Button onClick={handleSave} disabled={saving || !dirty || hasErrors}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {s.save}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">{t.homePromos.readOnly}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
