"use client";

import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AdActiveSwitch,
  AdChips,
  AdMoviesCell,
  AdThumb,
  adLimitChips,
  adMetaLine,
  adResultLines,
  adWhenLines,
  adWhereText,
} from "@/components/ads/AdCells";
import { adShowState, type AdShowStateSettings } from "@/components/ads/adHealth";
import { adHasMedia } from "@/components/ads/adForm";
import { formatLabel, statusBadge, statusSentence } from "@/components/ads/adWords";
import { useLanguage } from "@/lib/context/language-context";
import type { Ad } from "@/types/ad";

interface AdCardListProps {
  ads: Ad[];
  isLoading: boolean;
  /** How many skeleton cards stand in while the page loads. */
  placeholderCount?: number;
  canManage: boolean;
  busyId: string | null;
  settings: AdShowStateSettings | null;
  now: number;
  onToggleActive: (ad: Ad, isActive: boolean) => void;
  onWhy: (ad: Ad) => void;
  onPreview: (ad: Ad) => void;
  onEdit: (ad: Ad) => void;
  onDelete: (ad: Ad) => void;
}

/** Skeleton cards stand in for at most this many — a phone shows three or four at once. */
const MAX_PLACEHOLDERS = 4;

/**
 * The ads as cards below md (2026-11-04, the `PhoneList` board), where the
 * six-column table would only scroll sideways: the picture, the name and
 * its type line; the visible status with its reason; the "Show to viewers"
 * switch; and "Will it show?" with the rest of the actions behind "⋯". The
 * same words as the table (AdCells.tsx), stacked.
 */
export function AdCardList({
  ads,
  isLoading,
  placeholderCount = MAX_PLACEHOLDERS,
  canManage,
  busyId,
  settings,
  now,
  onToggleActive,
  onWhy,
  onPreview,
  onEdit,
  onDelete,
}: AdCardListProps) {
  const { t } = useLanguage();
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: Math.min(placeholderCount, MAX_PLACEHOLDERS) }, (_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    );
  }
  if (ads.length === 0) {
    return (
      <p className="glass-card rounded-xl px-4 py-10 text-center text-sm text-muted-foreground">
        {t.adsUi.list.noMatches}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {ads.map((ad) => (
        <li key={ad.id}>
          <AdCard
            ad={ad}
            canManage={canManage}
            busy={busyId === ad.id}
            settings={settings}
            now={now}
            onToggleActive={onToggleActive}
            onWhy={onWhy}
            onPreview={onPreview}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </li>
      ))}
    </ul>
  );
}

interface AdCardProps extends Omit<AdCardListProps, "ads" | "isLoading" | "placeholderCount" | "busyId"> {
  ad: Ad;
  busy: boolean;
}

function AdCard({ ad, canManage, busy, settings, now, onToggleActive, onWhy, onPreview, onEdit, onDelete }: AdCardProps) {
  const { t } = useLanguage();
  const s = t.adsUi.shared;
  const a = t.adsUi.list.actions;
  const badge = statusBadge(t, adShowState(ad, settings, now), ad.format, settings);
  const media = adHasMedia(ad);
  const results = adResultLines(t, ad).join(" · ");
  return (
    <article className="glass-card flex flex-col gap-3 rounded-xl p-4" aria-label={ad.title}>
      <div className="flex items-start gap-3">
        <AdThumb ad={ad} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-semibold break-words">{ad.title}</span>
          <span className="text-xs text-muted-foreground">
            {[formatLabel(t, ad.format), adMetaLine(t, ad)].join(" · ")}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={badge.label} tone={badge.tone} className="normal-case" />
        </div>
        <p className="text-[13px] leading-snug text-muted-foreground">{statusSentence(t, ad, settings, now)}</p>
      </div>

      <dl className="grid gap-1.5 text-[13px] leading-snug">
        <div>
          <dt className="sr-only">{t.adsUi.list.columns.whereWhen}</dt>
          <dd>
            {adWhereText(t, ad)} · <span className="text-muted-foreground">{adWhenLines(t, ad).join(" · ")}</span>
          </dd>
        </div>
        <div>
          <dt className="sr-only">{t.adsUi.list.columns.movies}</dt>
          <dd>
            <AdMoviesCell ad={ad} className="max-w-none min-w-0 text-muted-foreground" />
          </dd>
        </div>
        <div>
          <dt className="sr-only">{t.adsUi.list.columns.results}</dt>
          <dd className="text-muted-foreground tabular-nums">{results}</dd>
        </div>
      </dl>
      <AdChips chips={adLimitChips(t, ad)} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <AdActiveSwitch ad={ad} canManage={canManage} busy={busy} onToggle={onToggleActive} />
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => onWhy(ad)}>
            {s.willItShow}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" aria-label={a.more(ad.title)} />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-44">
              <DropdownMenuItem disabled={!media} onClick={() => onPreview(ad)}>
                <Eye />
                {media ? s.preview : ad.format === "CORNER" ? a.previewNoPicture : a.previewNoVideo}
              </DropdownMenuItem>
              {canManage && (
                <>
                  <DropdownMenuItem onClick={() => onEdit(ad)}>
                    <Pencil />
                    {s.edit}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => onDelete(ad)}>
                    <Trash2 />
                    {s.delete}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </article>
  );
}
