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
import { STATUS_TONE } from "@/components/movies/columns";
import type { AdminEpisode } from "@/types/series";

const FALLBACK_POSTER = "https://picsum.photos/seed/myanflix-poster/400/600";

interface GetEpisodeColumnsOptions {
  canManage: boolean;
  onEdit: (episode: AdminEpisode) => void;
  onDelete: (episode: AdminEpisode) => void;
  onPublish: (episode: AdminEpisode) => void;
  /** Episode id currently publishing, if any — disables its own button to prevent a double-trigger. */
  publishingId: string | null;
}

export function getEpisodeColumns({
  canManage,
  onEdit,
  onDelete,
  onPublish,
  publishingId,
}: GetEpisodeColumnsOptions): ColumnDef<AdminEpisode>[] {
  return [
    {
      accessorKey: "title",
      header: "Episode Title",
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
      header: "Series",
      cell: ({ row }) => (
        <Badge variant="secondary" className="font-normal">
          {row.original.seriesTitle ?? "—"}
        </Badge>
      ),
    },
    {
      accessorKey: "seasonNumber",
      header: "Season",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.seasonNumber ?? "—"}</span>
      ),
    },
    {
      accessorKey: "episodeNumber",
      header: "Episode",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.episodeNumber ?? "—"}</span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Upload Date",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.original.createdAt), "MMM d, yyyy")}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge label={row.original.status} tone={STATUS_TONE[row.original.status]} />
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const episode = row.original;
        return (
          <div className="flex items-center justify-end gap-2">
            {canManage && episode.status === "READY_TO_PUBLISH" && (
              <Button size="sm" disabled={publishingId === episode.id} onClick={() => onPublish(episode)}>
                {publishingId === episode.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Rocket className="size-3.5" />
                )}
                Publish
              </Button>
            )}
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(episode)}>
                    <Pencil className="size-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => onDelete(episode)}>
                    <Trash2 className="size-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      },
    },
  ];
}
