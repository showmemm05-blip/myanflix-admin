"use client";

import Image from "next/image";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Loader2, Pencil, RefreshCw, Rocket, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RowActionButton, RowActions } from "@/components/tables/RowActions";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { AccessType, Movie, MovieStatus } from "@/types/movie";
import { formatDuration, UNKNOWN_DURATION } from "@/lib/format";

export const STATUS_TONE: Record<MovieStatus, StatusTone> = {
  PUBLISHED: "success",
  PROCESSING: "info",
  DRAFT: "neutral",
  ARCHIVED: "warning",
  UPLOADING: "info",
  FAILED: "danger",
  READY_TO_PUBLISH: "warning",
};

export const ACCESS_TYPE_TONE: Record<AccessType, StatusTone> = {
  FREE: "neutral",
  SUBSCRIPTION: "info",
};

const FALLBACK_POSTER = "https://picsum.photos/seed/myanflix-poster/400/600";

/**
 * Translated equivalents of `STATUS_TONE`/`ACCESS_TYPE_TONE` above — kept as
 * separate functions (rather than changing those exports' shape) because
 * `ACCESS_TYPE_TONE`/`STATUS_TONE` are also consumed by series/episode
 * columns outside the movies page group, which don't have a `t` to pass in.
 */
export function getStatusLabel(t: TranslationShape, status: MovieStatus): string {
  const labels: Record<MovieStatus, string> = {
    PUBLISHED: t.movies.status.published,
    PROCESSING: t.movies.status.processing,
    DRAFT: t.movies.status.draft,
    ARCHIVED: t.movies.status.archived,
    UPLOADING: t.movies.status.uploading,
    FAILED: t.movies.status.failed,
    READY_TO_PUBLISH: t.movies.status.readyToPublish,
  };
  return labels[status];
}

export function getAccessTypeLabel(t: TranslationShape, accessType: AccessType): string {
  return accessType === "FREE" ? t.movies.accessType.free : t.movies.accessType.subscription;
}

interface GetMovieColumnsOptions {
  t: TranslationShape;
  /** MOVIES.EDIT — the Edit button and the reprocess-video retry. */
  canEdit: boolean;
  /** MOVIES.DELETE — the destructive button. */
  canDelete: boolean;
  onView: (movie: Movie) => void;
  onEdit: (movie: Movie) => void;
  onDelete: (movie: Movie) => void;
  onReprocess: (movie: Movie) => void;
  /** Movie id currently reprocessing, if any — disables its own button to prevent a double-trigger. */
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
  /** MOVIES.PUBLISH — required on top of `onPublish` for the button to show. */
  canPublish?: boolean;
}

export function getMovieColumns({
  t,
  canEdit,
  canDelete,
  onView,
  onEdit,
  onDelete,
  onReprocess,
  reprocessingId,
  onPublish,
  publishingId,
  canPublish = false,
}: GetMovieColumnsOptions): ColumnDef<Movie>[] {
  const columns: ColumnDef<Movie>[] = [
    {
      accessorKey: "title",
      header: t.movies.columns.title,
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
              <p className="text-xs tabular-nums text-muted-foreground">{movie.releaseYear}</p>
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
      accessorKey: "releaseYear",
      header: t.movies.columns.year,
      cell: ({ row }) => <span className="text-sm tabular-nums">{row.original.releaseYear}</span>,
    },
    {
      accessorKey: "duration",
      header: t.movies.columns.duration,
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {formatDuration(row.original.duration) ?? UNKNOWN_DURATION}
        </span>
      ),
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
        <StatusBadge label={getStatusLabel(t, row.original.status)} tone={STATUS_TONE[row.original.status]} />
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
          {canPublish && onPublish && movie.status === "READY_TO_PUBLISH" && (
            <Button size="sm" disabled={publishingId === movie.id} onClick={() => onPublish(movie)}>
              {publishingId === movie.id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Rocket className="size-3.5" />
              )}
              {t.movies.publish}
            </Button>
          )}
          <RowActions>
            <RowActionButton icon={Eye} label={t.common.view} onClick={() => onView(movie)} />
            {canEdit && (
              <>
                <RowActionButton icon={Pencil} label={t.common.edit} onClick={() => onEdit(movie)} />
                {movie.status === "DRAFT" && (
                  <RowActionButton
                    icon={RefreshCw}
                    label={t.movies.columns.reprocessVideo}
                    loading={reprocessingId === movie.id}
                    onClick={() => onReprocess(movie)}
                  />
                )}
              </>
            )}
            {canDelete && (
              <RowActionButton
                icon={Trash2}
                label={t.common.delete}
                destructive
                onClick={() => onDelete(movie)}
              />
            )}
          </RowActions>
        </div>
      );
    },
  });

  return columns;
}
