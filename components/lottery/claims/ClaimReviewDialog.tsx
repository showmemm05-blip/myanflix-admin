"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CircleCheck,
  CircleX,
  Info,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/shared/ErrorState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ClaimStatusBadge } from "@/components/lottery/claims/ClaimStatusBadge";
import { RejectClaimDialog } from "@/components/lottery/claims/RejectClaimDialog";
import {
  claimDrawLabel,
  formatMoney,
  isClaimNotFound,
  isClaimStateError,
  moneyNumber,
} from "@/components/lottery/claims/claimFormat";
import { formatRate, lotteryErrorMessage } from "@/components/lottery/drawFormat";
import { formatBaht, formatKs, prizeGroupName } from "@/components/lottery/resultsFormat";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import type { TranslationShape } from "@/lib/i18n/translations";
import { formatMmt, formatMmtDate } from "@/lib/myanmar-time";
import { formatLocalPhone } from "@/lib/phone";
import { userLabel } from "@/lib/user-label";
import { cn } from "@/lib/utils";
import { lotteryService } from "@/services/api/lotteryService";
import {
  LOTTERY_PRIZE_GROUP_KEYS,
  type LotteryAdminClaim,
  type LotteryAdminClaimDetail,
  type LotteryPrizeGroupKey,
} from "@/types/lottery";

/** The winners endpoint's page cap — one customer's tickets in one draw fit in a page. */
const WINNERS_PAGE_SIZE = 100;

/** One ticket line of the dialog's table, whichever wire it came from. */
interface Line {
  ticketNo: string;
  number: string;
  groups: string[];
  baht: number;
  ks: number;
}

type BannerTone = "info" | "warning" | "success" | "danger";

const BANNER_STYLES: Record<BannerTone, { box: string; icon: string }> = {
  info: { box: "border-info/25 bg-info/10", icon: "text-info" },
  warning: { box: "border-warning/25 bg-warning/10", icon: "text-warning" },
  success: { box: "border-success/25 bg-success/10", icon: "text-success" },
  danger: { box: "border-destructive/25 bg-destructive/10", icon: "text-destructive" },
};

/** The group's label in the staff member's language when the key is one of the nine; the backend's name otherwise. */
function groupLabel(t: TranslationShape, key: string, name: string | null): string {
  return (LOTTERY_PRIZE_GROUP_KEYS as readonly string[]).includes(key)
    ? prizeGroupName(key as LotteryPrizeGroupKey, t)
    : (name ?? key);
}

interface ClaimReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The list row that was opened; null when opened from a deep link (?claim=<id>) with only the id in hand. */
  row: LotteryAdminClaim | null;
  /** The claim to load; null for a not-requested row, which has no claim yet. */
  claimId: string | null;
  /** LOTTERY.CLAIMS_CONFIRM — Confirm and pay, Reject…, Review again. */
  canConfirm: boolean;
  /** For a not-requested row (no detail to load): the draw's claim deadline, when the page knows it. */
  fallbackDeadlineAt?: string | null;
  /** The claim was paid, rejected or reopened (or found changed): the page refetches the list and the tiles. */
  onChanged: () => void;
}

/**
 * The board's Review dialog: the customer (name, phone, member since, wallet
 * balance now, earlier claims, New-account badge) beside every ticket of the
 * claim with its prize group, Baht and kyat, the total and the draw's rate,
 * a context banner, then ONE decision — "Confirm and pay <amount>" (primary)
 * · "Reject…" (destructive) · Close. Paid and not-requested rows open
 * read-only; a rejected one adds "Review again". The two actions show only
 * to LOTTERY.CLAIMS_CONFIRM holders; the backend is the real gate.
 *
 * The detail is loaded by id (the row alone cannot show the customer panel
 * or the ticket lines), and the two decisions wait for it: the review step
 * exists to check the customer and the tickets, so while the detail loads
 * the buttons are disabled, and when its GET fails the dialog shows the
 * error with a retry instead of a payable row. A not-requested row has no
 * claim to load, so its lines come from the draw's winners filtered to
 * this customer, and the row's own counts stand in when that lookup is
 * refused.
 */
export function ClaimReviewDialog({
  open,
  onOpenChange,
  row,
  claimId,
  canConfirm,
  fallbackDeadlineAt = null,
  onChanged,
}: ClaimReviewDialogProps) {
  const { t } = useLanguage();
  const c = t.lottery.claims;
  const d = c.dialog;
  const b = d.banner;

  const {
    data: detail,
    isLoading,
    error,
    refetch,
  } = useAsyncData<LotteryAdminClaimDetail | null>(
    () => (claimId ? lotteryService.getClaim(claimId) : Promise.resolve(null)),
    [claimId],
  );

  const notRequestedRow = row && row.id === null ? row : null;
  const { data: winnerLines, isLoading: linesLoading } = useAsyncData<Line[] | null>(
    () =>
      notRequestedRow
        ? lotteryService
            .listDrawWinners(notRequestedRow.drawId, { q: notRequestedRow.user.username, pageSize: WINNERS_PAGE_SIZE })
            .then((page) =>
              page.items
                .filter((w) => w.user.id === notRequestedRow.user.id && w.claimStatus === "not_requested")
                .map(
                  (w): Line => ({
                    ticketNo: w.ticketNo,
                    number: w.number,
                    groups: w.groups.map((g) => groupLabel(t, g.key, null)),
                    baht: w.baht,
                    ks: w.ks,
                  }),
                ),
            )
            .catch(() => null)
        : Promise.resolve(null),
    [notRequestedRow?.key],
  );

  const [busy, setBusy] = useState<"pay" | "reopen" | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectKey, setRejectKey] = useState(0);

  const claim: LotteryAdminClaim | null = detail ?? row;
  /** A claim was asked for by id and is not in hand yet: still loading, or its GET failed. */
  const detailPending = claimId !== null && !detail;
  /** The GET failed (and no retry is running): the row alone must not be paid or rejected. */
  const detailFailed = detailPending && error !== null && !isLoading;

  /** Someone decided this claim meanwhile: say so, reload it, and let the page refresh. */
  const handleConflict = () => {
    toast.message(d.stateChanged);
    refetch();
    onChanged();
  };

  const pay = async () => {
    if (!detail || !claim?.id) return;
    setBusy("pay");
    try {
      await lotteryService.confirmClaim(claim.id);
      toast.success(d.paidToast(formatMoney(claim.ks), userLabel(claim.user)), {
        description: d.paidToastDescription(claimDrawLabel(t, claim)),
      });
      onChanged();
      onOpenChange(false);
    } catch (err) {
      toast.error(d.payFailedToast, { description: lotteryErrorMessage(err, t) });
      if (isClaimStateError(err)) handleConflict();
    } finally {
      setBusy(null);
    }
  };

  const reopen = async () => {
    if (!detail || !claim?.id) return;
    setBusy("reopen");
    try {
      await lotteryService.reopenClaim(claim.id);
      toast.message(d.reopenedToast, {
        description: d.reopenedToastDescription(userLabel(claim.user), claimDrawLabel(t, claim)),
      });
      onChanged();
      onOpenChange(false);
    } catch (err) {
      toast.error(d.reopenFailedToast, { description: lotteryErrorMessage(err, t) });
      if (isClaimStateError(err)) handleConflict();
    } finally {
      setBusy(null);
    }
  };

  const openReject = () => {
    if (!detail) return;
    setRejectKey((k) => k + 1);
    setRejectOpen(true);
  };

  const close = (next: boolean) => {
    if (busy !== null) return;
    onOpenChange(next);
  };

  // ---- the words, from the detail when it is in hand, else from the row
  const headerOf = (of: LotteryAdminClaim) => ({
    title: d.title(userLabel(of.user)),
    description: [
      claimDrawLabel(t, of),
      formatMoney(of.ks),
      c.statuses[of.status],
      of.status === "requested" && of.requestedAt ? d.requestedAt(formatMmt(of.requestedAt)) : null,
    ]
      .filter(Boolean)
      .join(" · "),
  });
  const header = claim ? headerOf(claim) : null;
  let body: ReactNode;
  let footer: ReactNode;

  if (!claim || detailFailed) {
    body =
      error && !isLoading ? (
        <ErrorState
          title={isClaimNotFound(error) ? d.notFound : undefined}
          description={isClaimNotFound(error) ? undefined : d.loadError}
          onRetry={isClaimNotFound(error) ? undefined : refetch}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-64 rounded" />
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
      );
    footer = (
      <Button variant="outline" onClick={() => onOpenChange(false)}>
        {t.common.close}
      </Button>
    );
  } else {
    const name = userLabel(claim.user);
    const ksText = formatMoney(claim.ks);
    const status = claim.status;
    // The role and the status allow a decision; it is enabled only once the detail (customer + tickets) is in hand.
    const mayPay = status === "requested" && canConfirm && claim.id !== null;
    const mayReopen = status === "rejected" && canConfirm && claim.id !== null;
    const canPay = mayPay && !!detail;
    const canReopen = mayReopen && !!detail;
    const contact = formatLocalPhone(claim.user.phone) ?? claim.user.email ?? "—";
    const decidedBy = claim.decidedBy ? userLabel(claim.decidedBy) : t.common.unknownUser;
    const deadlineAt = detail?.draw.claimDeadlineAt ?? fallbackDeadlineAt;

    const lines: Line[] = detail
      ? detail.tickets.map((tk) => ({
          ticketNo: tk.ticketNo,
          number: tk.number,
          groups: tk.groups.map((g) => groupLabel(t, g.key, g.name)),
          baht: moneyNumber(tk.baht),
          ks: moneyNumber(tk.ks),
        }))
      : (winnerLines ?? []);
    /** The ticket lines are still on their way: the claim detail, or (not-requested row) the draw's winners lookup. */
    const linesPending = detailPending ? isLoading : notRequestedRow !== null && linesLoading;
    const totalBaht = lines.length > 0 ? lines.reduce((sum, l) => sum + l.baht, 0) : moneyNumber(claim.baht);
    const totalKs = lines.length > 0 ? lines.reduce((sum, l) => sum + l.ks, 0) : moneyNumber(claim.ks);

    const earlier = detail
      ? detail.customer.earlierClaims.paid + detail.customer.earlierClaims.rejected === 0
        ? d.earlierNone
        : d.earlier(detail.customer.earlierClaims.paid, detail.customer.earlierClaims.rejected)
      : "—";

    const banner: { tone: BannerTone; icon: LucideIcon; title: string; text: string } = (() => {
      if (status === "requested") {
        if (detail?.customer.isNewAccount) {
          const first = detail.customer.earlierClaims.paid + detail.customer.earlierClaims.rejected === 0;
          return {
            tone: "warning",
            icon: AlertTriangle,
            title: first ? b.newAccountTitle : b.newAccountRepeatTitle,
            text: b.newAccountText(formatMmtDate(detail.customer.memberSince), formatMoney(detail.customer.walletBalance)),
          };
        }
        return { tone: "info", icon: Info, title: b.payTitle, text: b.payText(ksText, name) };
      }
      if (status === "paid") {
        const when = formatMmt(claim.decidedAt);
        return {
          tone: "success",
          icon: CircleCheck,
          title: claim.paidAtPublish ? b.paidAtPublishTitle(when) : b.paidTitle(when, decidedBy),
          text: claim.transactionId ? b.paidText(claim.transactionId) : b.paidTextNoLedger,
        };
      }
      if (status === "rejected") {
        const reason = claim.rejectReason ? c.reasons[claim.rejectReason] : c.reasons.other;
        return {
          tone: "danger",
          icon: CircleX,
          title: b.rejectedTitle(formatMmt(claim.decidedAt), decidedBy, reason),
          text: b.rejectedText(claim.rejectNote?.trim() || b.noNote),
        };
      }
      return {
        tone: "info",
        icon: Info,
        title: b.notRequestedTitle,
        text: deadlineAt ? b.notRequestedText(formatMmt(deadlineAt)) : b.notRequestedTextNoDeadline,
      };
    })();
    const BannerIcon = banner.icon;

    const whenLine =
      status === "not_requested"
        ? deadlineAt
          ? d.whenNotRequested(formatMmt(deadlineAt))
          : d.whenNotRequestedNoDeadline
        : claim.requestedAt
          ? d.whenRequested(formatMmt(claim.requestedAt))
          : null;
    // The backend's draw.exchangeRate is nullable like AdminDrawView's; a claim only exists on a published draw, so null is theoretical — but never a crash.
    const rateLine =
      detail && detail.draw.exchangeRate !== null
        ? d.rateLine(formatRate(detail.draw.exchangeRate), t.lottery.draws.drawLabel(detail.draw.drawNo), formatMmt(detail.draw.publishedAt))
        : null;
    const permLine = mayPay ? d.perm.pay : mayReopen ? d.perm.reopen : d.perm.readOnly;

    body = (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <section
            aria-label={d.customer}
            className="flex flex-col gap-3 rounded-lg border border-[var(--border-strong)] bg-secondary/30 p-3"
          >
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{d.customer}</h3>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{d.name}</dt>
              <dd className="truncate font-medium">{name}</dd>
              <dt className="text-muted-foreground">{d.phone}</dt>
              <dd className="truncate font-mono text-xs tabular-nums" title={contact}>
                {contact}
              </dd>
              <dt className="text-muted-foreground">{d.memberSince}</dt>
              <dd className="tabular-nums">{detail ? formatMmtDate(detail.customer.memberSince) : isLoading ? "…" : "—"}</dd>
              <dt className="text-muted-foreground">{d.walletBalance}</dt>
              <dd className="tabular-nums">{detail ? formatMoney(detail.customer.walletBalance) : isLoading ? "…" : "—"}</dd>
              <dt className="text-muted-foreground">{d.earlierClaims}</dt>
              <dd className="tabular-nums">{isLoading && !detail ? "…" : earlier}</dd>
              <dt className="text-muted-foreground">{d.account}</dt>
              <dd>
                {detail ? (
                  detail.customer.isNewAccount ? (
                    <StatusBadge label={d.accountNew} tone="info" className="normal-case" />
                  ) : (
                    <StatusBadge label={d.accountActive} tone="success" className="normal-case" />
                  )
                ) : (
                  <span className="text-muted-foreground">{isLoading ? "…" : "—"}</span>
                )}
              </dd>
            </dl>
            <Link
              href={`/users/${encodeURIComponent(claim.user.id)}`}
              className="mt-auto text-sm text-info underline-offset-4 hover:underline"
            >
              {d.openCustomer}
            </Link>
          </section>

          <section
            aria-label={lines.length === 1 ? d.ticketsTitleOne : d.ticketsTitle(claim.ticketsCount)}
            className="flex min-w-0 flex-col gap-2"
          >
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {claim.ticketsCount === 1 ? d.ticketsTitleOne : d.ticketsTitle(claim.ticketsCount)}
            </h3>
            {lines.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-[var(--border-strong)]">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>{d.ticketColumns.ticket}</TableHead>
                      <TableHead>{d.ticketColumns.number}</TableHead>
                      <TableHead>{d.ticketColumns.group}</TableHead>
                      <TableHead className="text-right">{d.ticketColumns.baht}</TableHead>
                      <TableHead className="text-right">{d.ticketColumns.ks}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line) => (
                      <TableRow key={line.ticketNo}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{line.ticketNo}</TableCell>
                        <TableCell className="font-mono text-sm font-semibold tabular-nums">{line.number}</TableCell>
                        <TableCell className="text-sm">
                          <div className="flex flex-col gap-0.5">
                            {line.groups.map((g, i) => (
                              <span key={`${g}-${i}`}>{g}</span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{formatBaht(line.baht)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatKs(line.ks)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-foreground/[0.03] font-semibold hover:bg-foreground/[0.03]">
                      <TableCell colSpan={3}>{d.total}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatBaht(totalBaht)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatKs(totalKs)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ) : linesPending ? (
              <Skeleton className="h-28 rounded-lg" />
            ) : (
              <div className="rounded-lg border border-[var(--border-strong)] bg-secondary/30 p-3 text-sm">
                <p className="font-medium tabular-nums">{d.ticketsSummary(claim.ticketsCount, ksText)}</p>
                {/* Only a prize nobody requested yet has no lines to show; a claim's lines come with its detail. */}
                {claim.id === null && <p className="mt-0.5 text-xs text-muted-foreground">{d.ticketsUnavailable}</p>}
              </div>
            )}
            {rateLine && <p className="text-xs text-muted-foreground">{rateLine}</p>}
            {whenLine && <p className="text-xs text-muted-foreground">{whenLine}</p>}
          </section>
        </div>

        <div className={cn("flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm", BANNER_STYLES[banner.tone].box)} role="note">
          <BannerIcon className={cn("mt-0.5 size-4 shrink-0", BANNER_STYLES[banner.tone].icon)} aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium">{banner.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{banner.text}</p>
          </div>
        </div>
      </div>
    );

    footer = (
      <>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
          {permLine}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy !== null}>
            {t.common.close}
          </Button>
          {mayReopen && (
            <Button variant="secondary" onClick={reopen} disabled={busy !== null || !canReopen}>
              {busy === "reopen" ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              {d.reviewAgain}
            </Button>
          )}
          {mayPay && (
            <>
              <Button variant="destructive" onClick={openReject} disabled={busy !== null || !canPay}>
                {d.reject}
              </Button>
              <Button onClick={pay} disabled={busy !== null || !canPay}>
                {busy === "pay" ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
                {busy === "pay" ? d.paying : d.confirmPay(ksText)}
              </Button>
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {header ? header.title : c.title}
              {claim && <ClaimStatusBadge status={claim.status} />}
            </DialogTitle>
            <DialogDescription>{header ? header.description : isLoading ? "…" : d.loadError}</DialogDescription>
          </DialogHeader>
          {body}
          <DialogFooter className="sm:items-center sm:justify-between">{footer}</DialogFooter>
        </DialogContent>
      </Dialog>

      {claim?.id && rejectOpen && (
        <RejectClaimDialog
          key={rejectKey}
          open={rejectOpen}
          onOpenChange={setRejectOpen}
          claim={claim}
          claimId={claim.id}
          onRejected={() => {
            onChanged();
            onOpenChange(false);
          }}
          onConflict={handleConflict}
        />
      )}
    </>
  );
}
