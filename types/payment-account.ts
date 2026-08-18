export interface PaymentAccountType {
  id: string;
  value: string;
  label: string;
  requiresBankName: boolean;
  logoUrl: string | null;
}

export interface PaymentMethodTypeFormValues {
  label: string;
  requiresBankName?: boolean;
  logoUrl?: string | null;
}

export interface PaymentAccountStaffRef {
  id: string;
  username: string;
}

export interface PaymentAccount {
  id: string;
  type: string;
  /** Internal label distinguishing multiple accounts under the same `type` (e.g. "Main Account" vs "Backup Account") — never shown to users during deposit. */
  subname: string | null;
  accountName: string;
  accountNumber: string;
  bankName: string | null;
  note: string | null;
  isActive: boolean;
  /** Cached running totals — the source of truth is the PaymentAccountTransaction ledger, never editable directly. */
  balance: number;
  totalIn: number;
  totalOut: number;
  createdAt: string;
  updatedAt: string;
  createdBy: PaymentAccountStaffRef | null;
  updatedBy: PaymentAccountStaffRef | null;
}

export interface PaymentAccountFormValues {
  type: string;
  subname?: string;
  accountName: string;
  accountNumber: string;
  bankName?: string;
  note?: string;
  isActive?: boolean;
}
