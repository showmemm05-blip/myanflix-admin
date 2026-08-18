"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/lib/context/language-context";

export type StatusFilterValue = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

export function StatusFilterTabs({
  value,
  onValueChange,
  counts,
}: {
  value: StatusFilterValue;
  onValueChange: (value: StatusFilterValue) => void;
  counts: { all: number; pending: number; approved: number; rejected: number };
}) {
  const { t } = useLanguage();
  return (
    <Tabs value={value} onValueChange={(v) => v && onValueChange(v as StatusFilterValue)}>
      <TabsList>
        <TabsTrigger value="ALL">
          {t.shared.statusAll} <span className="text-muted-foreground">({counts.all})</span>
        </TabsTrigger>
        <TabsTrigger value="PENDING">
          {t.shared.statusPending} <span className="text-pending">({counts.pending})</span>
        </TabsTrigger>
        <TabsTrigger value="APPROVED">
          {t.shared.statusApproved} <span className="text-approved">({counts.approved})</span>
        </TabsTrigger>
        <TabsTrigger value="REJECTED">
          {t.shared.statusRejected} <span className="text-rejected">({counts.rejected})</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
