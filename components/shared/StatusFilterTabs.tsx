"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  return (
    <Tabs value={value} onValueChange={(v) => v && onValueChange(v as StatusFilterValue)}>
      <TabsList>
        <TabsTrigger value="ALL">
          All <span className="text-muted-foreground">({counts.all})</span>
        </TabsTrigger>
        <TabsTrigger value="PENDING">
          Pending <span className="text-warning">({counts.pending})</span>
        </TabsTrigger>
        <TabsTrigger value="APPROVED">
          Approved <span className="text-success">({counts.approved})</span>
        </TabsTrigger>
        <TabsTrigger value="REJECTED">
          Rejected <span className="text-destructive">({counts.rejected})</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
