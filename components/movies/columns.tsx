"use client";

import Image from "next/image";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Loader2, MoreHorizontal, Pencil, RefreshCw, Rocket, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { formatKyat } from "@/lib/currency";
import type { Movie, MovieStatus } from "@/types/movie";

export const STATUS_TONE: Record<MovieStatus, StatusTone> = {
  PUBLISHED: "success",
  PROCESSING: "info",
  DRAFT: "neutral",
  ARCHIVED: "warning",
  UPLOADING: "info",
  FAILED: "danger",
  READY_TO_PUBLISH: "warning",
};

const FALLBACK_POSTER = "https://picsum.photos/seed/myanflix-poster/400/600";

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

interface GetMovieColumnsOptions {
  canManage: boolean;
  onView: (movie: Movie) => void;
  onEdit: (movie: Movie) => void;
  onDelete: (movie: Movie) => void;
  onReprocess: (movie: Movie) => void;
  /** Movie id currently reprocessing, if any — disables its own dropdown item to prevent a double-trigger. */
  reprocessingId: string | null;
  /**
   * Opt-in only — omitting this leaves the actions column exactly as it is
   * on the main Movies page. When provided, a visible "Publish" button
   * appears for any READY_TO_PUBLISH row (used by the dedicated Ready to
   * Publish page) — publishing is always this explicit, admin-triggered
   * action, never automatic.
   */
  onPublish?: (movie: Movie) => void;
  /** Movie id currently publishing, if any — disables its own button to prevent a double-trigger. */
  publishingId?: string | null;
}

export function getMovieColumns({
  canManage,
  onView,
  onEdit,
  onDelete,
  onReprocess,
  reprocessingId,
  onPublish,
  publishingId,
}: GetMovieColumnsOptions): ColumnDef<Movie>[] {
  const columns: ColumnDef<Movie>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => {
        const movie = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
              <Image
                src={movie.posterUrl ?? FALLBACK_POSTER}
                alt={movie.title}
                fill
                className="object-cover"
                sizes="40px"
              />
            </div>
            <div className="min-w-0">
              <p className="max-w-52 truncate font-medium">{movie.title}</p>
              <p className="text-xs text-muted-foreground">{movie.releaseYear}</p>
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
      accessorKey: "releaseYear",
      header: "Year",
      cell: ({ row }) => <span className="text-sm">{row.original.releaseYear}</span>,
    },
    {
      accessorKey: "duration",
      header: "Duration",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{formatDuration(row.original.duration)}</span>
      ),
    },
    {
      accessorKey: "price",
      header: "Price",
      cell: ({ row }) =>
        row.original.isPremium ? (
          <span className="font-medium tabular-nums">{formatKyat(row.original.price)}</span>
        ) : (
          <Badge variant="outline">Free</Badge>
        ),
    },
    {
      accessorKey: "rating",
      header: "Rating",
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original.rating > 0 ? row.original.rating.toFixed(1) : "—"}
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
  ];

  columns.push({
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const movie = row.original;
      return (
        <div className="flex items-center justify-end gap-2">
          {canManage && onPublish && movie.status === "READY_TO_PUBLISH" && (
            <Button size="sm" disabled={publishingId === movie.id} onClick={() => onPublish(movie)}>
              {publishingId === movie.id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Rocket className="size-3.5" />
              )}
              Publish
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(movie)}>
                <Eye className="size-4" />
                View
              </DropdownMenuItem>
              {canManage && (
                <>
                  <DropdownMenuItem onClick={() => onEdit(movie)}>
                    <Pencil className="size-4" />
                    Edit
                  </DropdownMenuItem>
                  {movie.status === "DRAFT" && (
                    <DropdownMenuItem
                      disabled={reprocessingId === movie.id}
                      onClick={() => onReprocess(movie)}
                    >
                      <RefreshCw className={reprocessingId === movie.id ? "size-4 animate-spin" : "size-4"} />
                      Reprocess video
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem variant="destructive" onClick={() => onDelete(movie)}>
                    <Trash2 className="size-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  });

  return columns;
}
