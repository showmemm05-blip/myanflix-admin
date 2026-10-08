"use client";

import Image from "next/image";
import { format } from "date-fns";
import { AlertTriangle, ChevronDown, ChevronUp, GripVertical, Pencil, Trash2 } from "lucide-react";
import { PromoArt } from "@/components/home-promos/PromoArt";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { RowActionButton, RowActions } from "@/components/tables/RowActions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import type { HomePromo, HomePromoLiveState } from "@/types/home-promo";

const LIVE_TONES: Record<HomePromoLiveState, StatusTone> = {
  LIVE: "success",
  SCHEDULED: "info",
  ENDED: "neutral",
  OFF: "neutral",
};

const when = (iso: string) => format(new Date(iso), "d MMM yyyy, HH:mm");

interface PromoRowProps {
  promo: HomePromo;
  index: number;
  count: number;
  canManage: boolean;
  busy: boolean;
  dragging: boolean;
  dropTarget: boolean;
  onMove: (direction: -1 | 1) => void;
  onToggleActive: (active: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
}

/** One promo in its list: art, both titles, where it is in its life, what its button does. */
export function PromoRow({
  promo,
  index,
  count,
  canManage,
  busy,
  dragging,
  dropTarget,
  onMove,
  onToggleActive,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
}: PromoRowProps) {
  const { t, language } = useLanguage();
  const h = t.homePromos;
  const picture = promo.imageUrl ?? (promo.kind === "SPOTLIGHT" ? promo.target?.imageUrl ?? null : null);

  const windowParts = [
    promo.startsAt ? h.startsOn(when(promo.startsAt)) : null,
    promo.endsAt ? (promo.liveState === "ENDED" ? h.endedOn : h.endsOn)(when(promo.endsAt)) : null,
  ].filter(Boolean);

  let targetLine = h.ctaSummaries[promo.ctaTarget];
  if (promo.target) targetLine += `: ${promo.target.title ?? h.picker.deletedTitle}`;
  else if (promo.ctaTarget === "URL" && promo.url) targetLine += `: ${promo.url}`;

  const targetWarning = promo.target
    ? promo.target.missing
      ? h.targetMissing
      : !promo.target.isVisible
        ? promo.kind === "COMING_SOON"
          ? h.targetHiddenNoButton
          : h.targetHiddenSkipped
        : null
    : null;

  const primaryTitle = language === "mm" ? promo.titleMm : promo.titleEn;
  const secondaryTitle = language === "mm" ? promo.titleEn : promo.titleMm;

  return (
    <Card
      draggable={canManage && !busy}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnter={onDragEnter}
      onDragOver={(e) => {
        if (canManage) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "glass-card flex flex-row items-center gap-3 p-3 transition-shadow",
        !promo.isActive || promo.liveState === "ENDED" ? "opacity-70" : "",
        dragging ? "opacity-40" : "",
        dropTarget ? "ring-2 ring-ring" : "",
      )}
    >
      {canManage && (
        <GripVertical
          className="hidden size-4 shrink-0 cursor-grab text-muted-foreground sm:block"
          aria-label={h.dragHandle}
        />
      )}
      <span className="tabular-nums w-5 shrink-0 text-center text-xs text-muted-foreground">{index + 1}</span>
      <div className="relative hidden aspect-video w-32 shrink-0 overflow-hidden rounded-md bg-muted sm:block">
        {picture ? (
          <Image src={picture} alt="" fill sizes="128px" className="object-cover" unoptimized draggable={false} />
        ) : (
          <PromoArt preset={promo.artPreset} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold">{primaryTitle}</p>
          <StatusBadge label={h.liveStates[promo.liveState]} tone={LIVE_TONES[promo.liveState]} />
        </div>
        <p className="truncate text-sm text-muted-foreground">{secondaryTitle}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {targetLine}
          {promo.kind === "COMING_SOON" && promo.dateText ? ` · ${promo.dateText}` : ""}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {windowParts.length > 0 ? windowParts.join(" · ") : h.noWindow}
          {promo.createdBy ? ` · ${h.addedBy(promo.createdBy.displayName || promo.createdBy.username)}` : ""}
        </p>
        {targetWarning && (
          <p
            className={cn(
              "mt-1 flex items-start gap-1.5 text-xs",
              promo.target?.missing ? "text-destructive" : "text-warning",
            )}
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {targetWarning}
          </p>
        )}
        {promo.target?.type === "BOOK" && !targetWarning && (
          <p className="mt-1 text-xs text-muted-foreground">{h.bookSignedInOnly}</p>
        )}
      </div>

      {canManage && (
        <>
          {/* The backend re-checks the linked title on every change, so with a
              deleted title the switch would always be refused — it stays off
              limits until the promo is edited or deleted (the warning says so). */}
          <Switch
            checked={promo.isActive}
            disabled={busy || !!promo.target?.missing}
            onCheckedChange={onToggleActive}
            aria-label={h.activeSwitch}
            title={promo.target?.missing ? h.targetMissing : undefined}
          />
          <div className="flex flex-col">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={busy || index === 0}
              onClick={() => onMove(-1)}
              aria-label={h.moveUp}
            >
              <ChevronUp className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={busy || index === count - 1}
              onClick={() => onMove(1)}
              aria-label={h.moveDown}
            >
              <ChevronDown className="size-4" />
            </Button>
          </div>
          <RowActions>
            <RowActionButton icon={Pencil} label={t.common.edit} onClick={onEdit} />
            <RowActionButton icon={Trash2} label={t.common.delete} destructive onClick={onDelete} />
          </RowActions>
        </>
      )}
    </Card>
  );
}
