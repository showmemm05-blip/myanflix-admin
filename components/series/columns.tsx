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
import { ACCESS_TYPE_LABEL, ACCESS_TYPE_TONE } from "@/components/movies/columns";
import type { SeriesListItem } from "@/types/series";

const FALLBACK_POSTER = "https://picsum.photos/seed/myanflix-series-poster/400/600";

interface GetSeriesColumnsOptions {
  onDelete: (series: SeriesListItem) => void;
}

export function getSeriesColumns({ onDelete }: GetSeriesColumnsOptions): ColumnDef<SeriesListItem>[] {
  return [
    {
      accessorKey: "title",
      header: "Title",
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
      header: "Genre",
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
      header: "Language",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.language}</span>,
    },
    {
      accessorKey: "accessType",
      header: "Access",
      cell: ({ row }) => (
        <StatusBadge
          label={ACCESS_TYPE_LABEL[row.original.accessType]}
          tone={ACCESS_TYPE_TONE[row.original.accessType]}
        />
      ),
    },
    {
      accessorKey: "episodeCount",
      header: "Episodes",
      cell: ({ row }) => (
        <span className="tabular-nums text-sm">
          {row.original.episodeCount} episode{row.original.episodeCount === 1 ? "" : "s"}
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
              Manage
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onClick={() => onDelete(series)}>
                  <Trash2 className="size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
