"use client";

import Image from "next/image";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { RowActionButton, RowActions } from "@/components/tables/RowActions";
import { cn } from "@/lib/utils";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { Actor } from "@/types/actor";

/**
 * Up to two letters standing in for a missing headshot — first + last initial
 * for a full name, the first two characters for a mononym.
 *
 * Exported because the cast picker needs the same stand-in for the same
 * photo-less people, and two implementations would drift.
 */
export function actorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters =
    parts.length === 1
      ? Array.from(parts[0]).slice(0, 2).join("")
      : Array.from(parts[0])[0] + Array.from(parts[parts.length - 1])[0];
  return letters.toUpperCase();
}

/**
 * The round headshot, or a neutral initials disc when `imageUrl` is null.
 *
 * The null case renders no `<img>` at all rather than an image element
 * pointed at an empty src — a broken-image glyph in every row of a fresh
 * catalog is worse than no image.
 */
export function ActorAvatar({
  name,
  imageUrl,
  className = "size-9",
}: {
  name: string;
  imageUrl: string | null;
  className?: string;
}) {
  if (!imageUrl) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-medium text-muted-foreground",
          className,
        )}
      >
        {actorInitials(name)}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full border border-border bg-muted",
        className,
      )}
    >
      {/* alt is the person's own name — data, not a translatable string. */}
      <Image src={imageUrl} alt={name} fill className="object-cover" sizes="36px" />
    </div>
  );
}

interface GetActorColumnsOptions {
  t: TranslationShape;
  /** ACTORS.EDIT — the Edit button. */
  canEdit: boolean;
  /** ACTORS.DELETE — the destructive button. */
  canDelete: boolean;
  onEdit: (actor: Actor) => void;
  onDelete: (actor: Actor) => void;
}

export function getActorColumns({
  t,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: GetActorColumnsOptions): ColumnDef<Actor>[] {
  const columns: ColumnDef<Actor>[] = [
    {
      accessorKey: "name",
      header: t.actors.columns.actor,
      cell: ({ row }) => {
        const actor = row.original;
        return (
          <div className="flex items-center gap-3">
            <ActorAvatar name={actor.name} imageUrl={actor.imageUrl} />
            <span className="max-w-56 truncate font-medium">{actor.name}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "movieCount",
      header: t.actors.columns.movies,
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {t.actors.movieCount(row.original.movieCount)}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: t.actors.columns.added,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.original.createdAt), "d MMM yyyy")}
        </span>
      ),
    },
  ];

  if (canEdit || canDelete) {
    columns.push({
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const actor = row.original;
        return (
          <RowActions>
            {canEdit && (
              <RowActionButton icon={Pencil} label={t.common.edit} onClick={() => onEdit(actor)} />
            )}
            {canDelete && (
              <RowActionButton
                icon={Trash2}
                label={t.common.delete}
                destructive
                onClick={() => onDelete(actor)}
              />
            )}
          </RowActions>
        );
      },
    });
  }

  return columns;
}
