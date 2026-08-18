"use client";

/**
 * "Recent Activity in This Network" — the last handful of deposits and
 * withdrawals across every account the search turned up, newest first.
 *
 * This is the one place the two money flows sit side by side, so direction is
 * said four ways at once: a coloured left rail, a tinted row, a direction icon
 * and a signed amount. The detail line carries what the record actually holds —
 * method, reference, and for a withdrawal the payout number, which is itself a
 * node on the canvas and selects it when clicked.
 *
 * Everything the network did is HERE, filterable by kind — there is no link out
 * to the deposits or withdrawals queues, because needing one was the problem
 * this panel was asked to solve.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Hash,
  Phone,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { useLanguage } from "@/lib/context/language-context";
import { formatSignedKyat } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { RelationshipActivityItem } from "@/types/user-relationship";
import { phoneNodeId } from "./useRelationshipGraph";

/** Deposits and withdrawals share the same three-state lifecycle, so one mapping covers both. */
function statusTone(status: string): StatusTone {
  switch (status.toUpperCase()) {
    case "APPROVED":
    case "COMPLETED":
      return "success";
    case "PENDING":
    case "PROCESSING":
      return "warning";
    case "REJECTED":
    case "FAILED":
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
}

export interface RecentActivityStripProps {
  items: RelationshipActivityItem[];
  /**
   * Select a node on the canvas. A withdrawal's payout account IS a phone node,
   * so its chip becomes the link between this list and the graph — which is the
   * whole point of showing the number here.
   */
  onSelectNode?: (nodeId: string) => void;
  /** The API capped the list — say so rather than implying this is everything. */
  truncated?: boolean;
  className?: string;
}

type ActivityFilter = "ALL" | "DEPOSIT" | "WITHDRAWAL";

export function RecentActivityStrip({
  items,
  truncated = false,
  onSelectNode,
  className,
}: RecentActivityStripProps) {
  const { t } = useLanguage();
  const copy = t.userRelationships.activity;
  const [filter, setFilter] = useState<ActivityFilter>("ALL");

  const counts = useMemo(
    () => ({
      deposits: items.filter((item) => item.type === "DEPOSIT").length,
      withdrawals: items.filter((item) => item.type === "WITHDRAWAL").length,
    }),
    [items],
  );

  const visible = useMemo(
    () => (filter === "ALL" ? items : items.filter((item) => item.type === filter)),
    [items, filter],
  );

  const statusLabel = (status: string): string => {
    switch (status.toUpperCase()) {
      case "APPROVED":
        return t.shared.statusApproved;
      case "PENDING":
        return t.shared.statusPending;
      case "REJECTED":
        return t.shared.statusRejected;
      default:
        return status;
    }
  };

  return (
    <Card className={cn("glass-card", className)}>
      {/* `flex`, not just `flex-row`: CardHeader is a GRID by default, so a
          bare flex-row left the title and the tabs on separate rows. */}
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        {/* No count line: the filter tabs already carry the numbers, and saying
            "8 deposits · 3 withdrawals" beside "Deposits 8 / Withdrawals 3" was
            the same fact twice. */}
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-4 text-muted-foreground" />
          {copy.title}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* The whole point of the panel is that the admin never has to leave
              it, so the filter lives here rather than on another page. */}
          <div
            role="tablist"
            aria-label={copy.title}
            className="inline-flex items-center gap-0.5 rounded-lg bg-secondary/60 p-0.5"
          >
            {(
              [
                ["ALL", copy.filterAll, items.length],
                ["DEPOSIT", copy.filterDeposits, counts.deposits],
                ["WITHDRAWAL", copy.filterWithdrawals, counts.withdrawals],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                onClick={() => setFilter(value)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors",
                  filter === value && "bg-card text-foreground shadow-sm",
                )}
              >
                {label}
                <span className="tabular-nums opacity-70">{count}</span>
              </button>
            ))}
          </div>

        </div>
      </CardHeader>

      <CardContent>
        {truncated && (
          <p className="mb-2 rounded-md border border-dashed border-warning/40 bg-warning/8 px-3 py-2 text-xs text-muted-foreground">
            {copy.truncatedNote(items.length)}
          </p>
        )}

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-8 text-center">
            <p className="text-sm font-medium">{copy.emptyTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{copy.emptyDescription}</p>
          </div>
        ) : (
          /* Every row, right here — a bounded scroll area rather than a link to
             another page. max-h keeps the graph reachable without a long scroll
             past the list; the list itself scrolls internally. */
          <ul className="max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
            {visible.length === 0 && (
              <li className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                {copy.noneOfType}
              </li>
            )}
            {visible.map((item) => {
              const isDeposit = item.type === "DEPOSIT";
              return (
                <li
                  key={`${item.type}-${item.id}`}
                  className={cn(
                    "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border-l-2 py-2.5 pr-2 pl-3 transition-colors",
                    // Direction is carried by the rail and the tint, not just by
                    // the sign on the number — the two flows have to be
                    // separable at a glance in a mixed list.
                    isDeposit
                      ? "border-l-success bg-success/[0.04] hover:bg-success/[0.08]"
                      : "border-l-warning bg-warning/[0.04] hover:bg-warning/[0.08]",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      isDeposit
                        ? "bg-success/15 text-success"
                        : "bg-warning/15 text-warning",
                    )}
                  >
                    {isDeposit ? (
                      <ArrowDownToLine className="size-4.5" />
                    ) : (
                      <ArrowUpFromLine className="size-4.5" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-center gap-2 text-sm">
                      <Link
                        href={`/users/${item.userId}`}
                        className="truncate font-medium hover:text-primary hover:underline"
                      >
                        {item.userName}
                      </Link>
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase",
                          isDeposit
                            ? "bg-success/15 text-success"
                            : "bg-warning/15 text-warning",
                        )}
                      >
                        {isDeposit ? copy.typeDeposit : copy.typeWithdrawal}
                      </span>
                    </p>

                    {/* Detail line: everything the record actually holds. */}
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {/* Same stamp the Deposits and Withdrawals tables print
                          ("d MMM yyyy, HH:mm:ss"), so a row here and the same
                          row there are comparable at a glance. "4 days ago"
                          moves to the tooltip — useful, but not the thing an
                          investigator matches records on. */}
                      <time
                        dateTime={item.createdAt}
                        title={formatDistanceToNow(new Date(item.createdAt), {
                          addSuffix: true,
                        })}
                        className="tabular-nums"
                      >
                        {format(new Date(item.createdAt), "d MMM yyyy, HH:mm:ss")}
                      </time>

                      {item.method && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="inline-flex items-center gap-1">
                            <Wallet className="size-3" />
                            {item.method}
                          </span>
                        </>
                      )}

                      {item.reference && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="inline-flex items-center gap-0.5 font-mono tabular-nums">
                            <Hash className="size-3" />
                            {item.reference}
                          </span>
                        </>
                      )}

                      {/* The payout number is a node on the canvas — clicking it
                          selects that node instead of leaving the page. */}
                      {item.phone &&
                        (onSelectNode ? (
                          <button
                            type="button"
                            onClick={() =>
                              onSelectNode(phoneNodeId(item.phone!.replace(/\D/g, "")))
                            }
                            className="inline-flex items-center gap-1 rounded px-1 py-0.5 font-mono tabular-nums text-[var(--chart-3)] hover:bg-[var(--chart-3)]/10 hover:underline"
                          >
                            <Phone className="size-3" />
                            {item.phone}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                            <Phone className="size-3" />
                            {item.phone}
                          </span>
                        ))}
                    </div>
                  </div>

                  <div className="ml-auto flex shrink-0 items-center gap-3">
                    <StatusBadge
                      label={statusLabel(item.status)}
                      tone={statusTone(item.status)}
                    />
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        isDeposit ? "text-success" : "text-warning",
                      )}
                    >
                      {formatSignedKyat(item.amount, isDeposit ? "in" : "out")}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
