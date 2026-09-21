"use client";

import Image from "next/image";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { EyeOff, Rocket, Settings2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RowActionButton, RowActions } from "@/components/tables/RowActions";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { ACCESS_TYPE_TONE, getAccessTypeLabel } from "@/components/movies/columns";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { SeriesListItem, SeriesStatus } from "@/types/series";

/** Same idiom as movies' STATUS_TONE, but for show-level SeriesStatus — also consumed by the manage page header. */
export const SERIES_STATUS_TONE: Record<SeriesStatus, StatusTone> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  UNPUBLISHED: "warning",
};

export function getSeriesStatusLabel(t: TranslationShape, status: SeriesStatus): string {
  const labels: Record<SeriesStatus, string> = {
    DRAFT: t.movies.status.draft,
    PUBLISHED: t.movies.status.published,
    UNPUBLISHED: t.series.statusUnpublished,
  };
  return labels[status];
}

const FALLBACK_POSTER = "https://picsum.photos/seed/myanflix-series-poster/400/600";

interface GetSeriesColumnsOptions {
  t: TranslationShape;
  /** SERIES.DELETE. */
  canDelete: boolean;
  /** SERIES.PUBLISH / SERIES.UNPUBLISH — the row toggles between the two. */
  canPublish: boolean;
  canUnpublish: boolean;
  onDelete: (series: SeriesListItem) => void;
  /** Publish when DRAFT/UNPUBLISHED, unpublish when PUBLISHED — the handler reads the row's current status. */
  onToggleStatus: (series: SeriesListItem) => void;
}

export function getSeriesColumns({
  t,
  canDelete,
  canPublish,
  canUnpublish,
  onDelete,
  onToggleStatus,
}: GetSeriesColumnsOptions): ColumnDef<SeriesListItem>[] {
  return [
    {
      accessorKey: "title",
      header: t.movies.columns.title,
      cell: ({ row }) => {
        const series = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
              <Image
                src={series.posterUrl ?? FALLBACK_POSTER}
                alt={series.title}
                fill
                className="object-cover"
                sizes="40px"
              />
            </div>
            <div className="min-w-0">
              <p className="max-w-52 truncate font-medium">{series.title}</p>
              <p className="text-xs text-muted-foreground">{series.releaseYear}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "genre",
      header: t.movies.columns.genre,
      cell: ({ row }) => (
        <Badge variant="secondary" className="font-normal">
          {row.original.genre}
        </Badge>
      ),
      filterFn: (row, _id, value: string) =>
        row.original.genre.toLowerCase().includes(value.toLowerCase()),
    },
    {
      accessorKey: "language",
      header: t.series.columns.language,
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.language}</span>,
    },
    {
      accessorKey: "accessType",
      header: t.movies.columns.access,
      cell: ({ row }) => (
        <StatusBadge
          label={getAccessTypeLabel(t, row.original.accessType)}
          tone={ACCESS_TYPE_TONE[row.original.accessType]}
        />
      ),
    },
    {
      accessorKey: "episodeCount",
      header: t.series.columns.episodesHeader,
      cell: ({ row }) => (
        <span className="tabular-nums text-sm">
          {t.series.columns.episodeCount(row.original.episodeCount)}
        </span>
      ),
    },
    {
      accessorKey: "rating",
      header: t.movies.columns.rating,
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original.rating > 0 ? row.original.rating.toFixed(1) : "—"}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: t.movies.columns.status,
      cell: ({ row }) => (
        <StatusBadge
          label={getSeriesStatusLabel(t, row.original.status)}
          tone={SERIES_STATUS_TONE[row.original.status]}
        />
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const series = row.original;
        // Publishing and unpublishing are separate permissions, and this one
        // control does whichever the row's current status calls for.
        const canToggleStatus =
          series.status === "PUBLISHED" ? canUnpublish : canPublish;
        return (
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" render={<Link href={`/series/${series.id}`} />} nativeButton={false}>
              <Settings2 className="size-3.5" />
              {t.series.columns.manage}
            </Button>
            {(canToggleStatus || canDelete) && (
              <RowActions>
                {canToggleStatus && (
                  <RowActionButton
                    icon={series.status === "PUBLISHED" ? EyeOff : Rocket}
                    label={series.status === "PUBLISHED" ? t.series.unpublish : t.movies.publish}
                    onClick={() => onToggleStatus(series)}
                  />
                )}
                {canDelete && (
                  <RowActionButton
                    icon={Trash2}
                    label={t.common.delete}
                    destructive
                    onClick={() => onDelete(series)}
                  />
                )}
              </RowActions>
            )}
          </div>
        );
      },
    },
  ];
}
