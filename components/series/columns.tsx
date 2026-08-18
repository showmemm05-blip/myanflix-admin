"use client";

import Image from "next/image";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Settings2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ACCESS_TYPE_TONE, getAccessTypeLabel } from "@/components/movies/columns";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { SeriesListItem } from "@/types/series";

const FALLBACK_POSTER = "https://picsum.photos/seed/myanflix-series-poster/400/600";

interface GetSeriesColumnsOptions {
  t: TranslationShape;
  onDelete: (series: SeriesListItem) => void;
}

export function getSeriesColumns({ t, onDelete }: GetSeriesColumnsOptions): ColumnDef<SeriesListItem>[] {
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
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const series = row.original;
        return (
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" render={<Link href={`/series/${series.id}`} />} nativeButton={false}>
              <Settings2 className="size-3.5" />
              {t.series.columns.manage}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onClick={() => onDelete(series)}>
                  <Trash2 className="size-4" />
                  {t.common.delete}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
