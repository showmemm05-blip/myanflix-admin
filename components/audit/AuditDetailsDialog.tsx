"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Crosshair,
  ExternalLink,
  FileDiff,
  Info,
  MonitorSmartphone,
  UserRound,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PlatformChip } from "@/components/tracking/PlatformChip";
import { relativeActivity } from "@/components/tracking/activeUserColumns";
import {
  AUDIT_CATEGORY_TONE,
  actionLabel,
  categoryLabel,
  formatChangeValue,
  formatJson,
  isStructured,
  isSystemEntry,
  targetHref,
  targetTypeLabel,
} from "@/components/audit/auditFormat";
import { userLabel } from "@/lib/user-label";
import { useLanguage } from "@/lib/context/language-context";
import type { AuditLogEntry } from "@/types/audit";

const EM_DASH = "—";

function formatDateTime(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "d MMM yyyy, HH:mm:ss");
}

/*
 * Section / Field are the same small idiom TransactionDetailsDialog uses,
 * copied rather than imported so the two dialogs can drift apart without
 * one owning the other's layout.
 */
function Section({
  title,
  icon: Icon,
  children,
  grid = true,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  /** Off for the sections that lay out their own body (the changes table). */
  grid?: boolean;
}) {
  return (
    <section className="rounded-lg border border-border bg-secondary/20 px-3 py-2.5">
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        <Icon className="size-3.5" />
        {title}
      </h3>
      {grid ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">{children}</dl>
      ) : (
        children
      )}
    </section>
  );
}

/** A field with nothing in it is dropped, so the panel's length tracks what is actually known. */
function Field({
  label,
  value,
  mono,
  full,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  full?: boolean;
}) {
  if (value === null || value === undefined || value === "" || value === EM_DASH) return null;
  return (
    <div className={`min-w-0 ${full ? "col-span-2 sm:col-span-3" : ""}`}>
      <dt className="text-[11px] leading-tight text-muted-foreground">{label}</dt>
      <dd
        className={`min-w-0 text-sm leading-snug font-medium ${mono ? "font-mono text-xs break-all" : "break-words"}`}
      >
        {value}
      </dd>
    </div>
  );
}

/** A diff / metadata value: objects and arrays pretty-printed, scalars inline, null as a dash. */
function ValueCell({ value, none }: { value: unknown; none: string }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">{none}</span>;
  }
  if (isStructured(value)) {
    return (
      <pre className="max-h-48 overflow-auto rounded-md bg-secondary/50 p-2 font-mono text-[11px] leading-snug whitespace-pre-wrap break-all">
        {formatJson(value)}
      </pre>
    );
  }
  return <span className="break-words">{formatChangeValue(value, none)}</span>;
}

export function AuditDetailsDialog({
  entry,
  open,
  onOpenChange,
}: {
  entry: AuditLogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLanguage();
  const d = t.audit.details;

  if (!entry) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent />
      </Dialog>
    );
  }

  const system = isSystemEntry(entry);
  const actorName = system
    ? t.audit.system
    : userLabel({ displayName: entry.actorDisplayName, username: entry.actorUsername });
  // `actor.avatar` is a storage key, not a URL — only an absolute URL can be
  // rendered; anything else falls through to the initials.
  const avatarSrc = entry.actor?.avatar?.startsWith("http") ? entry.actor.avatar : undefined;
  const href = targetHref(entry);
  const changes = entry.changes ?? [];
  const metadata = Object.entries(entry.metadata ?? {});
  const exactTime = formatDateTime(entry.createdAt);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{d.title}</DialogTitle>
          <DialogDescription>
            {actionLabel(t, entry.action)}
            {entry.targetLabel ? ` — ${entry.targetLabel}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2.5">
          <section className="rounded-lg border border-border bg-secondary/20 px-3 py-2.5">
            <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              <UserRound className="size-3.5" />
              {d.who}
            </h3>
            <div className="mb-2.5 flex items-center gap-3">
              <Avatar className="size-9">
                <AvatarImage src={avatarSrc} alt={actorName} />
                <AvatarFallback>{actorName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{actorName}</p>
                {!system && (
                  <p className="truncate text-xs text-muted-foreground">@{entry.actorUsername}</p>
                )}
              </div>
              {entry.actorRole && (
                <RoleBadge role={entry.actorRole} label={entry.actorAppRoleName ?? undefined} />
              )}
              {/* The snapshot is what the row says; the joined account says
                  whether it still exists. A missing join on a non-system row
                  is a deleted account — worth saying out loud. */}
              {!system && !entry.actor && (
                <StatusBadge label={t.audit.deletedAccount} tone="neutral" />
              )}
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              <Field label={d.actorId} value={entry.actorId} mono full />
            </dl>
          </section>

          <Section title={d.what} icon={Zap}>
            <Field label={d.action} value={actionLabel(t, entry.action)} />
            <Field
              label={d.category}
              value={
                <StatusBadge
                  label={categoryLabel(t, entry.category)}
                  tone={AUDIT_CATEGORY_TONE[entry.category] ?? "neutral"}
                />
              }
            />
            <Field
              label={d.time}
              value={
                exactTime && (
                  <span>
                    {exactTime}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      ({relativeActivity(entry.createdAt, t)})
                    </span>
                  </span>
                )
              }
            />
            <Field label={d.actionKey} value={entry.action} mono />
            <Field label={d.entryId} value={entry.id} mono full />
          </Section>

          <Section title={d.target} icon={Crosshair}>
            <Field label={d.type} value={targetTypeLabel(t, entry.targetType)} />
            <Field label={d.label} value={entry.targetLabel} full />
            <Field label={d.targetId} value={entry.targetId} mono full />
            {href && (
              <Field
                label={d.open}
                value={
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    render={<Link href={href} />}
                    nativeButton={false}
                  >
                    <ExternalLink className="size-3.5" />
                    {d.open}
                  </Button>
                }
              />
            )}
          </Section>

          <Section title={d.changes} icon={FileDiff} grid={false}>
            {changes.length > 0 ? (
              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-40">{d.field}</TableHead>
                      <TableHead>{d.before}</TableHead>
                      <TableHead>{d.after}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {changes.map((change) => (
                      <TableRow key={change.field}>
                        <TableCell className="align-top font-mono text-xs">
                          {change.field}
                        </TableCell>
                        <TableCell className="align-top text-xs">
                          <ValueCell value={change.from} none={d.none} />
                        </TableCell>
                        <TableCell className="align-top text-xs">
                          <ValueCell value={change.to} none={d.none} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : entry.after || entry.before ? (
              // A create carries only `after`, a delete only `before` — show
              // whichever snapshot exists so the entry is not an empty box.
              <dl className="grid grid-cols-1 gap-2">
                <Field
                  label={entry.after ? d.after : d.before}
                  value={<ValueCell value={entry.after ?? entry.before} none={d.none} />}
                  full
                />
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">{d.noChanges}</p>
            )}
          </Section>

          {metadata.length > 0 && (
            <Section title={d.metadata} icon={Info}>
              {metadata.map(([key, value]) => (
                <Field
                  key={key}
                  label={key}
                  value={<ValueCell value={value} none={d.none} />}
                  full={isStructured(value)}
                />
              ))}
            </Section>
          )}

          <Section title={d.device} icon={MonitorSmartphone}>
            <Field label={d.platform} value={<PlatformChip platform={entry.platform} />} />
            <Field label={d.ip} value={entry.ip} mono />
            <Field label={d.userAgent} value={entry.userAgent} mono full />
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
