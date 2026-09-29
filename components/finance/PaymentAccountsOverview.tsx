"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ImageIcon, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/shared/ErrorState";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { formatKyat } from "@/lib/currency";
import { getSocket } from "@/lib/socket";
import { paymentAccountService } from "@/services/api/paymentAccountService";
import type { PaymentAccount, PaymentAccountType } from "@/types/payment-account";

/**
 * The per-account glance on the Finance overview: one row per payment
 * account with its total in, total out and balance, plus a totals row. The
 * full ledger (account numbers, status, history) stays on
 * /finance/payment-accounts — this card answers "how much is where?" without
 * leaving the overview, which is what the owner asked for.
 *
 * Reads GET /payment-accounts, which every staff session may call (it is the
 * same list the deposit forms use), so FINANCE.VIEW is the only gate. Both
 * finance views mount it — the balances are not part of the revenue
 * breakdown that FINANCE.EXPORT unlocks.
 */
export function PaymentAccountsOverview() {
  const { t } = useLanguage();
  const m = t.finance.accountsOverview;
  const { data, isLoading, error, refetch } = useAsyncData(async () => {
    const [accounts, types] = await Promise.all([
      paymentAccountService.getAccounts(),
      paymentAccountService.getTypes(),
    ]);
    return { accounts, types };
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    // Same signal the ledger page uses: every balance change on any account
    // emits it, and the Decimal fields are re-read rather than patched.
    const handleUpdated = () => refetch();
    socket.on("payment-account.updated", handleUpdated);
    return () => {
      socket.off("payment-account.updated", handleUpdated);
    };
    // refetch is a fresh closure every render; every instance does the same
    // thing, so resubscribing per render would be churn (see the ledger page).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2">
            <Landmark className="size-4 text-muted-foreground" />
            {m.title}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{m.description}</p>
        </div>
        <Button variant="ghost" size="sm" render={<Link href="/finance/payment-accounts" />} nativeButton={false}>
          {m.viewAll}
          <ArrowRight className="size-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-md" />
            ))}
          </div>
        ) : error || !data ? (
          <ErrorState description={m.loadError} onRetry={refetch} />
        ) : data.accounts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t.paymentAccountLedger.list.emptyTitle}</p>
        ) : (
          <AccountsTable accounts={data.accounts} types={data.types} />
        )}
      </CardContent>
    </Card>
  );
}

function AccountsTable({ accounts, types }: { accounts: PaymentAccount[]; types: PaymentAccountType[] }) {
  const { t } = useLanguage();
  const c = t.paymentAccountLedger.columns;
  const typeLabel = (value: string) => types.find((type) => type.value === value)?.label ?? value;
  const typeLogo = (value: string) => types.find((type) => type.value === value)?.logoUrl ?? null;

  // Summed here, not on the server: the list is every account (a handful),
  // already in hand, and the totals row is a courtesy, not a ledger figure.
  const totals = accounts.reduce(
    (acc, a) => ({ totalIn: acc.totalIn + a.totalIn, totalOut: acc.totalOut + a.totalOut, balance: acc.balance + a.balance }),
    { totalIn: 0, totalOut: 0, balance: 0 },
  );

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{c.account}</TableHead>
            <TableHead className="text-right">{c.totalIn}</TableHead>
            <TableHead className="text-right">{c.totalOut}</TableHead>
            <TableHead className="text-right">{c.balance}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account) => {
            const label = typeLabel(account.type);
            const logoUrl = typeLogo(account.type);
            return (
              <TableRow key={account.id} className={account.isActive ? undefined : "opacity-60"}>
                <TableCell>
                  <Link href={`/finance/payment-accounts/${account.id}`} className="flex items-center gap-2.5 hover:underline">
                    <div
                      className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary/40"
                      title={label}
                    >
                      {logoUrl ? (
                        <Image src={logoUrl} alt={label} width={32} height={32} className="size-full object-cover" unoptimized />
                      ) : (
                        <ImageIcon className="size-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">{account.accountName}</span>
                      <span className="text-xs text-muted-foreground">
                        {label}
                        {account.subname ? ` · ${account.subname}` : ""}
                        {account.isActive ? "" : ` · ${t.common.inactive}`}
                      </span>
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="text-right text-success tabular-nums">{formatKyat(account.totalIn)}</TableCell>
                <TableCell className="text-right text-destructive tabular-nums">{formatKyat(account.totalOut)}</TableCell>
                <TableCell
                  className={
                    account.balance < 0
                      ? "text-right font-semibold text-destructive tabular-nums"
                      : "text-right font-semibold tabular-nums"
                  }
                >
                  {formatKyat(account.balance)}
                </TableCell>
              </TableRow>
            );
          })}
          {accounts.length > 1 && (
            <TableRow className="border-t-2 bg-secondary/20 font-semibold">
              <TableCell>{t.finance.accountsOverview.total}</TableCell>
              <TableCell className="text-right text-success tabular-nums">{formatKyat(totals.totalIn)}</TableCell>
              <TableCell className="text-right text-destructive tabular-nums">{formatKyat(totals.totalOut)}</TableCell>
              <TableCell className={totals.balance < 0 ? "text-right text-destructive tabular-nums" : "text-right tabular-nums"}>
                {formatKyat(totals.balance)}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
