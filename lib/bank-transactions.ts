import type {
  BankTransaction,
  BankTransactionStateFilter,
  BankTransactionView,
} from "@/types/bank-transaction";
import type { PaymentAccount, PaymentAccountType } from "@/types/payment-account";

/**
 * Twin of the backend's UNCLAIMED_AFTER_MS (risk-rules.ts): a stored
 * transfer nobody has claimed within two days is called out as unclaimed.
 * Derived here too — not only server-side — for the same reason as
 * NO_BANK_TRANSACTION in lib/bank-verification.ts: a row that crossed the
 * line since the last fetch, or one that arrived over the socket, must
 * render exactly like a freshly loaded one. Nothing ever sweeps the table.
 */
export const UNCLAIMED_AFTER_MS = 48 * 3_600_000;

type ViewInput = Pick<BankTransaction, "state" | "occurredAt" | "linkedDepositId" | "linkedWithdrawalId">;

/**
 * The read-time state. MATCHED with BOTH links null is a row whose deposit
 * or withdrawal was hard-deleted afterwards (the FK is ON DELETE SET NULL,
 * the state column is not touched) — shown as WAITING, the same way the
 * server's `view` maps it, so the admin sees money that is once again
 * unaccounted for rather than a false "matched".
 */
export function viewOf(row: ViewInput, now = Date.now()): BankTransactionView {
  switch (row.state) {
    case "AMBIGUOUS":
      return "AMBIGUOUS";
    case "MATCHED":
      return row.linkedDepositId === null && row.linkedWithdrawalId === null ? "WAITING" : "MATCHED";
    case "UNMATCHED":
      return now - new Date(row.occurredAt).getTime() > UNCLAIMED_AFTER_MS ? "UNCLAIMED" : "WAITING";
  }
}

/**
 * Client-side twin of the server's five `state` predicates — used to put
 * counts on the tabs from the loaded page and to decide whether a socket
 * row belongs under the active tab, never to filter what the server already
 * filtered.
 */
export function matchesStateFilter(row: ViewInput, filter: BankTransactionStateFilter, now = Date.now()): boolean {
  switch (filter) {
    case "all":
      return true;
    case "matched":
      return row.state === "MATCHED";
    case "ambiguous":
      return row.state === "AMBIGUOUS";
    case "unmatched":
      return row.state === "UNMATCHED" && viewOf(row, now) === "WAITING";
    case "unclaimed":
      return viewOf(row, now) === "UNCLAIMED";
  }
}

/**
 * The LOCAL calendar day of an instant as YYYY-MM-DD — the same shape
 * DateRangeFilter emits, so a socket row can be tested against the active
 * range without converting the range to instants (toISOString() would
 * shift the day across midnight for non-UTC offsets).
 */
export function localDayOf(iso: string): string {
  const d = new Date(iso);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join(
    "-",
  );
}

/** "…8ba77f6a" — enough of a uuid to recognise it in a button label. */
export function shortId(id: string): string {
  return `…${id.slice(-8)}`;
}

/** "KBZPay · K1" — the type's display label plus the internal subname, the way the ledger names an account. */
export function paymentAccountOptionLabel(account: PaymentAccount, types: PaymentAccountType[]): string {
  const typeLabel = types.find((ty) => ty.value === account.type)?.label ?? account.type;
  return `${typeLabel}${account.subname ? ` · ${account.subname}` : ""}`;
}

/**
 * The account a row belongs to, as a label. The loaded accounts list wins
 * (it has the type's display label); the list join's raw "type · subname"
 * is the fallback for an account this admin cannot see; the bare id is the
 * last resort so a row never renders an empty account cell.
 */
export function bankTransactionAccountLabel(
  row: Pick<BankTransaction, "paymentAccountId" | "paymentAccountLabel">,
  accounts: PaymentAccount[],
  types: PaymentAccountType[],
): string {
  const account = accounts.find((a) => a.id === row.paymentAccountId);
  if (account) return paymentAccountOptionLabel(account, types);
  return row.paymentAccountLabel ?? shortId(row.paymentAccountId);
}
