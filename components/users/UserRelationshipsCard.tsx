"use client";

import Link from "next/link";
import { ExternalLink, PhoneOff, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import { USER_STATUS_TONE as STATUS_TONE } from "@/lib/status-tones";
import { formatLocalPhone, isSearchablePhone } from "@/lib/phone";
import { userLabel } from "@/lib/user-label";
import { userRelationshipService } from "@/services/api/userRelationshipService";
import type { RelationshipEdgeKind } from "@/types/user-relationship";
import type { UserStatus } from "@/types/user";

/**
 * Compact relationship summary for one user's profile page.
 *
 * Reuses the exact network walk behind /users/relationships (same service
 * call, seeded with this user's profile phone) but renders only the headline:
 * how many OTHER accounts share this user's numbers, and who they are. The
 * full graph stays one click away via the deep link that page already
 * supports (`/users/relationships?phone=…`).
 *
 * States, deliberately distinct:
 *  - no searchable phone  → no fetch at all; one quiet line says why.
 *  - fetch refused/failed → the card vanishes, same permission-degradation
 *    contract as the profile's level and finance regions (.catch → null).
 *  - network of one       → "no linked accounts", a designed empty state.
 */
const MAX_ROWS = 8;

export function UserRelationshipsCard({
  userId,
  phone,
  className,
}: {
  /** The profile being viewed — filtered out of the "linked accounts" list. */
  userId: string;
  /** The profile phone; null/unsearchable skips the fetch entirely. */
  phone: string | null;
  className?: string;
}) {
  const { t } = useLanguage();
  const copy = t.users.relationshipsCard;
  const searchPhone = phone && isSearchablePhone(phone) ? phone : null;

  const { data, isLoading } = useAsyncData(
    () =>
      searchPhone
        ? userRelationshipService.getRelationshipNetwork(searchPhone).catch(() => null)
        : Promise.resolve(null),
    [searchPhone]
  );

  const STATUS_LABELS: Record<UserStatus, string> = {
    ACTIVE: t.common.active,
    SUSPENDED: t.users.profile.statusSuspended,
    BANNED: t.users.profile.statusBanned,
  };

  // Permission-degradation: the fetch was attempted and refused (or failed) —
  // disappear like the level card does, instead of showing an error shell.
  if (searchPhone && !isLoading && !data) return null;

  const others = data ? data.users.filter((u) => u.id !== userId) : [];
  const visible = others.slice(0, MAX_ROWS);
  const hiddenCount = others.length - visible.length;

  // How each account is attached: through a profile phone, a payout number,
  // or both. Edges are the authority — never re-derived from raw phones here.
  const kindsByUser = new Map<string, Set<RelationshipEdgeKind>>();
  if (data) {
    for (const edge of data.edges) {
      const set = kindsByUser.get(edge.userId) ?? new Set<RelationshipEdgeKind>();
      set.add(edge.kind);
      kindsByUser.set(edge.userId, set);
    }
  }
  const KIND_LABELS: Record<RelationshipEdgeKind, string> = {
    PROFILE: t.userRelationships.tree.profileLink,
    WITHDRAWAL: t.userRelationships.tree.withdrawalLink,
  };

  const fullGraphHref = searchPhone
    ? `/users/relationships?phone=${encodeURIComponent(formatLocalPhone(searchPhone) ?? searchPhone)}`
    : null;

  return (
    <Card size="sm" className={cn("glass-card", className)}>
      <CardHeader>
        <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {copy.title}
        </CardTitle>
        {fullGraphHref && (
          <CardAction>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-xs"
              render={<Link href={fullGraphHref} />}
              nativeButton={false}
            >
              <ExternalLink className="size-3.5" />
              {copy.openFullGraph}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        {!searchPhone ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <PhoneOff className="size-4 shrink-0" />
            <p>{copy.noPhone}</p>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 rounded-md" />
            <Skeleton className="h-8 rounded-md" />
            <Skeleton className="h-8 rounded-md" />
          </div>
        ) : (
          data && (
            <>
              {/* Headline numbers first — the answer before the roster. */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span className="tabular-nums">
                  <span className="font-heading text-lg font-bold">{others.length}</span>{" "}
                  <span className="text-xs text-muted-foreground">{copy.linkedAccounts}</span>
                </span>
                <span className="tabular-nums">
                  {/* totalPhones counts the seed phone itself, so a network of one
                      would read "1 shared numbers" beside "no linked accounts" —
                      a number nobody shares is not shared. */}
                  <span className="font-heading text-lg font-bold">
                    {others.length === 0 ? 0 : data.stats.totalPhones}
                  </span>{" "}
                  <span className="text-xs text-muted-foreground">{copy.sharedNumbers}</span>
                </span>
              </div>

              {others.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="size-4 shrink-0" />
                  <p>
                    <span className="font-medium text-foreground">{copy.emptyTitle}</span>{" "}
                    {copy.emptyDescription}
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col divide-y divide-border/60">
                  {visible.map((linked) => (
                    <li key={linked.id} className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0">
                      <Avatar className="size-6 shrink-0 border border-border">
                        <AvatarFallback className="text-[10px]">
                          {userLabel(linked).slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/users/${linked.id}`}
                            className="truncate text-sm font-medium hover:underline"
                          >
                            {userLabel(linked)}
                          </Link>
                          <StatusBadge
                            label={STATUS_LABELS[linked.status]}
                            tone={STATUS_TONE[linked.status]}
                            className="h-4 shrink-0 px-1.5 text-[10px]"
                          />
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {[...(kindsByUser.get(linked.id) ?? [])]
                            .map((kind) => KIND_LABELS[kind])
                            .join(" · ")}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {t.userRelationships.node.depositsCount(linked.depositCount)}
                      </span>
                    </li>
                  ))}
                  {hiddenCount > 0 && (
                    <li className="pt-1.5 text-xs text-muted-foreground">
                      {copy.moreCount(hiddenCount)}
                    </li>
                  )}
                </ul>
              )}
            </>
          )
        )}
      </CardContent>
    </Card>
  );
}
