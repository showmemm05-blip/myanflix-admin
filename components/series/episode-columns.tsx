"use client";

import Image from "next/image";
import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { Loader2, MoreHorizontal, Pencil, Rocket, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { STATUS_TONE, getStatusLabel } from "@/components/movies/columns";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { AdminEpisode } from "@/types/series";

const FALLBACK_POSTER = "https://picsum.photos/seed/myanflix-poster/400/600";

interface GetEpisodeColumnsOptions {
  t: TranslationShape;
  /** SERIES.EDIT — episodes are edited through their parent series. */
  canEdit: boolean;
  /** SERIES.DELETE. */
  canDelete: boolean;
  /** SERIES.PUBLISH — the inline publish button on a ready episode. */
  canPublish: boolean;
  onEdit: (episode: AdminEpisode) => void;
  onDelete: (episode: AdminEpisode) => void;
  onPublish: (episode: AdminEpisode) => void;
  /** Episode id currently publishing, if any — disables its own button to prevent a double-trigger. */
  publishingId: string | null;
}

export function getEpisodeColumns({
  t,
  canEdit,
  canDelete,
  canPublish,
  onEdit,
  onDelete,
  onPublish,
  publishingId,
}: GetEpisodeColumnsOptions): ColumnDef<AdminEpisode>[] {
  return [
    {
      accessorKey: "title",
      header: t.series.episodeColumns.title,
      cell: ({ row }) => {
        const episode = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
              <Image
                src={episode.posterUrl ?? FALLBACK_POSTER}
                alt={episode.title}
                fill
                className="object-cover"
                sizes="40px"
              />
            </div>
            <p className="max-w-52 truncate font-medium">{episode.title}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "seriesTitle",
      header: t.series.episodeColumns.series,
      cell: ({ row }) => (
        <Badge variant="secondary" className="font-normal">
          {row.original.seriesTitle ?? "—"}
        </Badge>
      ),
    },
    {
      accessorKey: "seasonNumber",
      header: t.series.episodeColumns.season,
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">{row.original.seasonNumber ?? "—"}</span>
      ),
    },
    {
      accessorKey: "episodeNumber",
      header: t.series.episodeColumns.episode,
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">{row.original.episodeNumber ?? "—"}</span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: t.series.episodeColumns.uploadDate,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.original.createdAt), "d MMM yyyy")}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: t.movies.columns.status,
      cell: ({ row }) => (
        <StatusBadge label={getStatusLabel(t, row.original.status)} tone={STATUS_TONE[row.original.status]} />
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const episode = row.original;
        return (
          <div className="flex items-center justify-end gap-2">
            {canPublish && episode.status === "READY_TO_PUBLISH" && (
              <Button size="sm" disabled={publishingId === episode.id} onClick={() => onPublish(episode)}>
                {publishingId === episode.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Rocket className="size-3.5" />
                )}
                {t.movies.publish}
              </Button>
            )}
            {(canEdit || canDelete) && (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canEdit && (
                    <DropdownMenuItem onClick={() => onEdit(episode)}>
                      <Pencil className="size-4" />
                      {t.common.edit}
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <DropdownMenuItem variant="destructive" onClick={() => onDelete(episode)}>
                      <Trash2 className="size-4" />
                      {t.common.delete}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      },
    },
  ];
}
