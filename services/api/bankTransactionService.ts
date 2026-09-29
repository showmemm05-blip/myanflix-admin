import { apiClient } from "./apiClient";
import type { PaginatedResponse } from "@/types/api";
import type {
  BankTransaction,
  BankTransactionDevice,
  BankTransactionDirection,
  BankTransactionQuery,
  BankTransactionState,
  BankTransactionView,
} from "@/types/bank-transaction";

/**
 * The list item as `GET /bank-transactions` serves it, and — minus the
 * `paymentAccount` join — the `bank-transaction.created` / `.updated`
 * socket payload. Optional where a payload legitimately omits the key.
 */
export interface BackendBankTransaction {
  id: string;
  deviceSerial: string;
  paymentAccountId: string;
  paymentAccount?: { type: string; subname: string | null; accountName: string } | null;
  direction: BankTransactionDirection;
  amount: number;
  currency: string;
  txCode: string;
  txCodeLast6: string;
  occurredAt: string;
  postedAt: string;
  counterparty: string | null;
  detailStatus: string | null;
  state: BankTransactionState;
  /** The server's read-time derivation; recomputed client-side when absent (socket payloads). */
  view?: BankTransactionView;
  linkedDepositId: string | null;
  linkedWithdrawalId: string | null;
  matchedAt: string | null;
  hasScreenshot: boolean;
  createdAt: string;
}

/** Exported so the page can turn a socket payload into a row with the same mapping as a fetched one. */
export function mapBankTransaction(row: BackendBankTransaction): BankTransaction {
  const account = row.paymentAccount;
  return {
    id: row.id,
    deviceSerial: row.deviceSerial,
    paymentAccountId: row.paymentAccountId,
    paymentAccountLabel: account ? `${account.type}${account.subname ? ` · ${account.subname}` : ""}` : null,
    direction: row.direction,
    amount: row.amount,
    currency: row.currency,
    txCode: row.txCode,
    txCodeLast6: row.txCodeLast6,
    occurredAt: row.occurredAt,
    postedAt: row.postedAt,
    counterparty: row.counterparty ?? null,
    detailStatus: row.detailStatus ?? null,
    state: row.state,
    // A payload without `view` gets a placeholder here; every renderer
    // re-derives through viewOf(row, now) anyway, so this never shows raw.
    view: row.view ?? (row.state === "MATCHED" ? "MATCHED" : row.state === "AMBIGUOUS" ? "AMBIGUOUS" : "WAITING"),
    linkedDepositId: row.linkedDepositId ?? null,
    linkedWithdrawalId: row.linkedWithdrawalId ?? null,
    matchedAt: row.matchedAt ?? null,
    hasScreenshot: row.hasScreenshot ?? false,
    createdAt: row.createdAt,
  };
}

export interface BankTransactionPage extends PaginatedResponse<BankTransaction> {
  /**
   * `total` is capped at 10 000 server-side (an exact count over an open
   * date range would scale with rows, not transfers); true when it hit the
   * cap and the page should say "10,000+" rather than a number.
   */
  totalCapped: boolean;
}

export const bankTransactionService = {
  /** Every phone-captured bank notification, newest bank time first — BANK_TRANSACTIONS.VIEW. */
  async getAll(query: BankTransactionQuery = {}): Promise<BankTransactionPage> {
    const res = await apiClient.get<PaginatedResponse<BackendBankTransaction> & { totalCapped?: boolean }>(
      "/bank-transactions",
      { params: query },
    );
    return { ...res, items: res.items.map(mapBankTransaction), totalCapped: res.totalCapped ?? false };
  },

  getOne(id: string): Promise<BankTransaction> {
    return apiClient.get<BackendBankTransaction>(`/bank-transactions/${id}`).then(mapBankTransaction);
  },

  /** Distinct phones with last-seen and counts — feeds the phone filter. */
  async getDevices(): Promise<BankTransactionDevice[]> {
    const res = await apiClient.get<{ items: BankTransactionDevice[] }>("/bank-transactions/devices");
    return res.items;
  },

  /**
   * The notification screenshot (BANK_TRANSACTIONS.BANK_EVIDENCE) — streamed
   * by the API, never a public URL, because it shows the business account
   * balance. 404 when the row has none.
   */
  fetchScreenshot(id: string): Promise<Blob> {
    return apiClient.getBlob(`/bank-transactions/${id}/screenshot`);
  },
};
