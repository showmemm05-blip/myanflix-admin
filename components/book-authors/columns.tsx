"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { RowActionButton, RowActions } from "@/components/tables/RowActions";
// The round portrait-or-initials disc is not actor-specific — it is exported
// for exactly this kind of reuse, and a second copy would drift.
import { ActorAvatar } from "@/components/actors/columns";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { BookAuthor } from "@/types/bookAuthor";

interface GetBookAuthorColumnsOptions {
  t: TranslationShape;
  /** BOOKS.EDIT — the Edit button. */
  canEdit: boolean;
  /** BOOKS.DELETE — the destructive button. */
  canDelete: boolean;
  onEdit: (author: BookAuthor) => void;
  onDelete: (author: BookAuthor) => void;
}

export function getBookAuthorColumns({
  t,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: GetBookAuthorColumnsOptions): ColumnDef<BookAuthor>[] {
  const columns: ColumnDef<BookAuthor>[] = [
    {
      accessorKey: "name",
      header: t.bookAuthors.columns.author,
      cell: ({ row }) => {
        const author = row.original;
        return (
          <div className="flex items-center gap-3">
            <ActorAvatar name={author.name} imageUrl={author.imageUrl} />
            <span className="max-w-56 truncate font-medium">{author.name}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "bookCount",
      header: t.bookAuthors.columns.books,
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {t.bookAuthors.bookCount(row.original.bookCount)}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: t.bookAuthors.columns.added,
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
        const author = row.original;
        return (
          <RowActions>
            {canEdit && (
              <RowActionButton icon={Pencil} label={t.common.edit} onClick={() => onEdit(author)} />
            )}
            {canDelete && (
              <RowActionButton
                icon={Trash2}
                label={t.common.delete}
                destructive
                onClick={() => onDelete(author)}
              />
            )}
          </RowActions>
        );
      },
    });
  }

  return columns;
}
