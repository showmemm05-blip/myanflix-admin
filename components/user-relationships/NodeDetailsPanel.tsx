"use client";

/**
 * Right-hand panel for whatever node is selected in the graph or the tree.
 *
 * It reads the raw payload rather than the drawable node, because the node
 * carries only what fits on a 180px pill — everything below (per-user
 * breakdowns, first/last used, the phones an account has touched) needs the
 * full `RelationshipNetwork`.
 *
 * Both CTAs deliberately leave for pages that already exist — the Deposits
 * list and the user profile — rather than growing another list page here.
 */

import Link from "next/link";
import { useState } from "react";
import { format } from "date-fns";
import {
  ArrowRight,
  ArrowUpFromLine,
  Check,
  Copy,
  Crosshair,
  Phone,
  User as UserIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useLanguage } from "@/lib/context/language-context";
import { formatKyat } from "@/lib/currency";
import { formatLocalPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import type {
  RelationshipNetwork,
  RelationshipNetworkUser,
} from "@/types/user-relationship";
import { isPhoneNode, isUserNode, phoneNodeId, userNodeId, type GraphNode } from "./types";

/* -------------------------------------------------------------------------- */
/* Small building blocks                                                       */
/* -------------------------------------------------------------------------- */

function StatTile({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg bg-secondary/50 px-3 py-2 ring-1 ring-border", className)}>
      <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
      <p className="mt-0.5 font-heading text-lg font-bold tabular-nums">{value}</p>
      {sub && <p className="truncate text-xs text-muted-foreground tabular-nums">{sub}</p>}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-sm tabular-nums">{value}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export interface NodeDetailsPanelProps {
  /** The selected node, or null when nothing is selected. */
  node: GraphNode | null;
  /** The payload the node came from — null before the first search resolves. */
  network: RelationshipNetwork | null;
  /** Clears the selection (the × button). */
  onClose: () => void;
  /** Jump the selection to a related node — a user row, or a phone chip. */
  onSelectNode: (id: string) => void;
  /** Centre + zoom the selected node in the canvas. */
  onFocusNode: (id: string) => void;
  className?: string;
}

export function NodeDetailsPanel({
  node,
  network,
  onClose,
  onSelectNode,
  onFocusNode,
  className,
}: NodeDetailsPanelProps) {
  const { t } = useLanguage();
  const copy = t.userRelationships.details;
  const nodeCopy = t.userRelationships.node;
  const [copied, setCopied] = useState(false);

  const formatDate = (iso: string | null): string =>
    iso ? format(new Date(iso), "d MMM yyyy") : copy.notRecorded;

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(copy.copiedToast);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(t.common.somethingWentWrong);
    }
  };

  if (!node) {
    return (
      <Card className={cn("glass-card", className)}>
        <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-muted-foreground/12 text-muted-foreground">
            <Crosshair className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">{copy.emptyTitle}</p>
            <p className="text-sm text-muted-foreground">{copy.emptyDescription}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const header = (
    <CardHeader className="flex-row items-start justify-between gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          variant="outline"
          className={cn(
            "gap-1.5",
            node.kind === "USER"
              ? "border-[var(--chart-5)]/30 bg-[var(--chart-5)]/12 text-[var(--chart-5)]"
              : "border-[var(--chart-3)]/30 bg-[var(--chart-3)]/12 text-[var(--chart-3)]",
          )}
        >
          {node.kind === "USER" ? <UserIcon /> : <Phone />}
          {node.kind === "USER" ? copy.userKind : copy.phoneKind}
        </Badge>
        <Badge variant="outline" className="text-muted-foreground">
          {copy.levelLabel(node.depth)}
        </Badge>
        {node.isSeed && (
          <Badge variant="outline" className="border-warning/30 bg-warning/12 text-warning">
            {nodeCopy.seedBadge}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onFocusNode(node.id)}
          title={copy.focusOnGraph}
          aria-label={copy.focusOnGraph}
        >
          <Crosshair />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          title={copy.close}
          aria-label={copy.close}
        >
          <X />
        </Button>
      </div>
    </CardHeader>
  );

  /* ---------------------------------------------------------------- phone -- */
  if (isPhoneNode(node)) {
    const phone = node.phone;
    // Names only — every figure below now arrives on the payload itself, so the
    // panel never has to re-derive (and risk disagreeing with) a total.
    const usersById = new Map<string, RelationshipNetworkUser>(
      (network?.users ?? []).map((u) => [u.id, u]),
    );
    const withdrawnTotal = phone.users.reduce((sum, entry) => sum + entry.totalAmount, 0);

    return (
      <Card className={cn("glass-card", className)}>
        {header}
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-heading truncate text-xl font-bold tracking-tight tabular-nums">
                {phone.phone}
              </p>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleCopy(phone.phone)}
                title={copy.copyNumber}
                aria-label={copy.copyNumber}
              >
                {copied ? <Check className="text-success" /> : <Copy />}
              </Button>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {nodeCopy.usersAndDeposits(phone.userCount, phone.depositCount)}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <StatTile label={copy.users} value={String(phone.userCount)} />
            <StatTile
              label={copy.withdrawals}
              value={String(phone.withdrawalCount)}
              sub={formatKyat(withdrawnTotal)}
            />
            {/* Deposits BY the users on this number — see the note on
                RelationshipNetworkPhone.depositCount for why no phone->deposit
                link exists to filter on. */}
            <StatTile
              label={copy.deposits}
              value={String(phone.depositCount)}
              sub={copy.depositsByTheseUsers}
            />
          </div>

          <div className="divide-y divide-border">
            <DetailRow label={copy.firstUsed} value={formatDate(phone.firstUsedAt)} />
            <DetailRow label={copy.lastUsed} value={formatDate(phone.lastUsedAt)} />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {copy.usersUsingThisNumber}
            </p>
            {phone.users.length === 0 ? (
              <p className="text-sm text-muted-foreground">{copy.noUsersForNumber}</p>
            ) : (
              <ul className="space-y-1">
                {phone.users.map((entry) => {
                  const user = usersById.get(entry.userId);
                  return (
                    <li key={entry.userId}>
                      <button
                        type="button"
                        onClick={() => onSelectNode(userNodeId(entry.userId))}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-secondary/60"
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--chart-5)]/15 text-[var(--chart-5)]">
                          <UserIcon className="size-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {user?.name ?? user?.username ?? t.common.unknownUser}
                          </span>
                          {/* Left: what this person did with THIS number. */}
                          <span className="block truncate text-xs text-muted-foreground">
                            {user ? `@${user.username}` : entry.userId}
                            {` · ${nodeCopy.txnCount(entry.withdrawalCount)}`}
                          </span>
                        </span>
                        {/* Right: the person's own deposit totals, network-wide —
                            the same figures on every number they appear under,
                            because a deposit carries no depositor phone. */}
                        <span className="shrink-0 text-right">
                          <span className="block text-sm font-semibold tabular-nums">
                            {formatKyat(entry.totalDepositedAmount)}
                          </span>
                          <span className="block text-[11px] text-muted-foreground tabular-nums">
                            {nodeCopy.depositsCount(entry.depositCount)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* A plain, unfiltered link on purpose. The Deposits page reads no
              URL filters, so a "?phone=" deep link would quietly show the whole
              list while pretending to be scoped — and there is nothing to scope
              it BY: deposits record only our receiving account, never the
              depositor's number. The count is stated in the label so the button
              says what it is about without implying the destination is filtered. */}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            render={<Link href="/deposits" />}
            nativeButton={false}
          >
            {copy.viewAllDepositsCount(phone.depositCount)}
            <ArrowRight data-icon="inline-end" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  /* ----------------------------------------------------------------- user -- */
  if (isUserNode(node)) {
    const user = node.user;
    const phonesById = new Map((network?.phones ?? []).map((p) => [p.normalized, p]));
    const userPhones = (network?.edges ?? []).filter((edge) => edge.userId === user.id);

    return (
      <Card className={cn("glass-card", className)}>
        {header}
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--chart-5)]/15 text-[var(--chart-5)]">
              <UserIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="font-heading truncate text-lg font-bold tracking-tight">
                {user.name || user.username}
              </p>
              <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <StatTile
              label={copy.deposits}
              value={String(user.depositCount)}
              sub={formatKyat(user.totalDepositedAmount)}
            />
            <StatTile
              label={copy.withdrawals}
              value={String(user.withdrawalCount)}
              sub={formatKyat(user.totalWithdrawnAmount)}
            />
          </div>

          <div className="divide-y divide-border">
            <DetailRow
              label={copy.profilePhone}
              value={formatLocalPhone(user.profilePhone) ?? copy.notRecorded}
            />
            <DetailRow label={copy.joined} value={formatDate(user.createdAt)} />
            <DetailRow label={copy.totalDeposited} value={formatKyat(user.totalDepositedAmount)} />
            <DetailRow label={copy.totalWithdrawn} value={formatKyat(user.totalWithdrawnAmount)} />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {copy.phonesUsed}
            </p>
            {userPhones.length === 0 ? (
              <p className="text-sm text-muted-foreground">{copy.noPhonesUsed}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {userPhones.map((edge) => {
                  const record = phonesById.get(edge.phone);
                  return (
                    <button
                      key={`${edge.phone}-${edge.kind}`}
                      type="button"
                      onClick={() => onSelectNode(phoneNodeId(edge.phone))}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--chart-3)]/25 bg-[var(--chart-3)]/10 py-1 pr-2 pl-1.5 text-xs transition-colors hover:bg-[var(--chart-3)]/20"
                    >
                      {edge.kind === "PROFILE" ? (
                        <Phone className="size-3 text-[var(--chart-3)]" />
                      ) : (
                        <ArrowUpFromLine className="size-3 text-[var(--chart-3)]" />
                      )}
                      <span className="tabular-nums">{record?.phone ?? edge.phone}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {edge.kind === "PROFILE" ? copy.profileTag : copy.withdrawalTag}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            render={<Link href={`/users/${user.id}`} />}
            nativeButton={false}
          >
            {copy.viewUserProfile}
            <ArrowRight data-icon="inline-end" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}
