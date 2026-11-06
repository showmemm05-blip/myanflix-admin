"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Pencil } from "lucide-react";
import { DreamPicture } from "@/components/lottery/DreamPicture";
import { DREAM_STATUS_TONES, dreamStatus } from "@/components/lottery/dreamFormat";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RowActionButton, RowActions } from "@/components/tables/RowActions";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { LotteryDream } from "@/types/lottery";

interface GetDreamColumnsOptions {
  t: TranslationShape;
  canManage: boolean;
  onEdit: (dream: LotteryDream) => void;
}

/** A name cell: the text, or a quiet dash when the admin has not filled it in. */
function NameCell({ value }: { value: string | null }) {
  const text = value?.trim();
  return text ? (
    <span className="block max-w-64 truncate">{text}</span>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
}

export function getDreamColumns({ t, canManage, onEdit }: GetDreamColumnsOptions): ColumnDef<LotteryDream>[] {
  const d = t.lottery.dreams;
  const columns: ColumnDef<LotteryDream>[] = [
    {
      accessorKey: "number",
      header: d.columns.number,
      enableSorting: false,
      cell: ({ row }) => <span className="font-mono text-sm font-semibold tabular-nums">{row.original.number}</span>,
    },
    {
      id: "picture",
      header: d.columns.picture,
      cell: ({ row }) => (
        <DreamPicture src={row.original.pictureUrl} className="size-10" />
      ),
    },
    {
      accessorKey: "nameEn",
      header: d.columns.nameEn,
      enableSorting: false,
      cell: ({ row }) => <NameCell value={row.original.nameEn} />,
    },
    {
      accessorKey: "nameMy",
      header: d.columns.nameMy,
      enableSorting: false,
      cell: ({ row }) => <NameCell value={row.original.nameMy} />,
    },
    {
      id: "status",
      header: d.columns.status,
      cell: ({ row }) => {
        const status = dreamStatus(row.original);
        return <StatusBadge label={d.statuses[status]} tone={DREAM_STATUS_TONES[status]} />;
      },
    },
  ];

  if (canManage) {
    columns.push({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <RowActions>
          <RowActionButton icon={Pencil} label={t.common.edit} onClick={() => onEdit(row.original)} />
        </RowActions>
      ),
    });
  }

  return columns;
}
