"use client";

import type { ReactNode } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PlatformChip } from "@/components/tracking/PlatformChip";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { userLabel } from "@/lib/user-label";
import { trackingService } from "@/services/api/trackingService";
import type { TrackedUser } from "@/types/tracking";

/** One page of sessions is plenty for a drawer; the newest are the ones that matter. */
const SESSION_LIMIT = 100;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] leading-tight text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm leading-snug">{children}</dd>
    </div>
  );
}

/**
 * The fetch half, split out so it MOUNTS when the drawer opens.
 *
 * `useAsyncData` fires on mount, so keeping this inside the open branch (and
 * keyed by user id) is what makes opening the drawer the thing that triggers
 * the request — rather than every row of the table pre-fetching a session
 * list nobody asked for.
 */
function SessionList({ userId }: { userId: string }) {
  const { t } = useLanguage();
  const d = t.tracking.phoneIp.drawer;

  const { data, isLoading, error } = useAsyncData(
    () => trackingService.getUserSessions(userId, { limit: SESSION_LIMIT }),
    [userId],
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg bg-secondary/60" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="py-6 text-center text-sm text-destructive">{d.loadError}</p>;
  }

  const sessions = data?.items ?? [];
  if (sessions.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{d.empty}</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {sessions.map((session) => (
        <li key={session.id} className="rounded-lg border border-border bg-secondary/20 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <PlatformChip platform={session.platform} />
            {/* An open session is the interesting one — it is happening now. */}
            {session.endedAt === null && (
              <StatusBadge label={d.stillOpen} tone="success" />
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <Field label={d.columns.started}>
              {format(new Date(session.createdAt), "d MMM yyyy, HH:mm")}
            </Field>
            <Field label={d.columns.lastSeen}>
              {format(new Date(session.lastSeenAt), "d MMM yyyy, HH:mm")}
            </Field>
            <Field label={d.columns.ended}>
              {session.endedAt ? (
                format(new Date(session.endedAt), "d MMM yyyy, HH:mm")
              ) : (
                <span className="text-muted-foreground">{d.stillOpen}</span>
              )}
            </Field>
            <Field label={d.columns.ipAddress}>
              {session.ipAddress ? (
                <span className="break-all font-mono text-xs">{session.ipAddress}</span>
              ) : (
                <span className="text-muted-foreground">{t.tracking.common.noIp}</span>
              )}
            </Field>
            <div className="col-span-2 min-w-0">
              <dt className="text-[11px] leading-tight text-muted-foreground">
                {d.columns.device}
              </dt>
              {/* The raw user-agent, unparsed: this is a forensic record, and
                  a prettified "Chrome on Android" would be this screen's own
                  guess rather than what the client actually sent. */}
              <dd className="break-words text-[11px] leading-snug text-muted-foreground">
                {session.userAgent ?? d.unknownDevice}
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

/**
 * Every session recorded for one account — the drawer behind the session
 * count in the Phone/IP table.
 */
export function UserSessionsDrawer({
  user,
  onOpenChange,
}: {
  /** The account whose sessions to show; null closes the drawer. */
  user: TrackedUser | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLanguage();
  const d = t.tracking.phoneIp.drawer;

  return (
    <Sheet open={user !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        {user && (
          <>
            <SheetHeader>
              <SheetTitle>{d.title}</SheetTitle>
              <SheetDescription>{d.description(userLabel(user))}</SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4">
              {/* Keyed by account so opening a second row refetches rather
                  than showing the first row's sessions under a new name. */}
              <SessionList key={user.id} userId={user.id} />
            </div>

            <SheetFooter>
              <SheetClose render={<Button variant="outline" />}>{d.close}</SheetClose>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
