"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  AdActiveSwitch,
  AdIdentityCell,
  AdMoviesCell,
  AdResultsCell,
  AdRowActions,
  AdWhereWhenCell,
} from "@/components/ads/AdCells";
import { AdStatusLine } from "@/components/ads/AdStatusLine";
import type { AdShowStateSettings } from "@/components/ads/adHealth";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { Ad } from "@/types/ad";

interface GetAdColumnsOptions {
  t: TranslationShape;
  /** ADS.MANAGE — the switch, Edit and Delete. "Will it show?" and Preview need only VIEW. */
  canManage: boolean;
  /** The ad whose switch is being saved, so a second click waits. */
  busyId: string | null;
  /** The Ad settings for the visible status; null while they load. */
  settings: AdShowStateSettings | null;
  /** The page's clock — the status line's "now". */
  now: number;
  onToggleActive: (ad: Ad, isActive: boolean) => void;
  onWhy: (ad: Ad) => void;
  onPreview: (ad: Ad) => void;
  onEdit: (ad: Ad) => void;
  onDelete: (ad: Ad) => void;
}

/**
 * The Advertisements table on md and wider (2026-11-04, the `Main` board):
 * Ad · Status (the visible status, its reason, "Why?" and the "Show to
 * viewers" switch) · Where and when · Movies · Results · actions. No
 * Priority column — "Goes first: N" is a chip under Where and when, only
 * when it is set. Below md the same cells come as cards (AdCardList.tsx).
 */
export function getAdColumns({
  t,
  canManage,
  busyId,
  settings,
  now,
  onToggleActive,
  onWhy,
  onPreview,
  onEdit,
  onDelete,
}: GetAdColumnsOptions): ColumnDef<Ad>[] {
  const c = t.adsUi.list.columns;
  return [
    {
      accessorKey: "title",
      header: c.ad,
      enableSorting: false,
      cell: ({ row }) => <AdIdentityCell ad={row.original} />,
    },
    {
      id: "status",
      header: c.status,
      cell: ({ row }) => (
        <div className="flex max-w-64 min-w-52 flex-col gap-2.5">
          <AdStatusLine ad={row.original} settings={settings} now={now} onWhy={onWhy} />
          <AdActiveSwitch
            ad={row.original}
            canManage={canManage}
            busy={busyId === row.original.id}
            onToggle={onToggleActive}
          />
        </div>
      ),
    },
    {
      id: "whereWhen",
      header: c.whereWhen,
      cell: ({ row }) => <AdWhereWhenCell ad={row.original} />,
    },
    {
      id: "movies",
      header: c.movies,
      cell: ({ row }) => <AdMoviesCell ad={row.original} />,
    },
    {
      id: "results",
      header: c.results,
      cell: ({ row }) => <AdResultsCell ad={row.original} />,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{c.actions}</span>,
      cell: ({ row }) => (
        <AdRowActions
          ad={row.original}
          canManage={canManage}
          onWillItShow={onWhy}
          onPreview={onPreview}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ),
    },
  ];
}
