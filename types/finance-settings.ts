export interface FinanceSettingsStaffRef {
  id: string;
  /** Login identity. Render `userLabel()` instead — never this raw. */
  username: string;
  displayName: string | null;
}

export interface FinanceSettings {
  id: string;
  minDepositAmount: number;
  maxDepositAmount: number;
  minWithdrawalAmount: number;
  maxWithdrawalAmount: number;
  updatedByUserId: string | null;
  updatedAt: string;
  updatedBy: FinanceSettingsStaffRef | null;
}

export interface FinanceSettingsFormValues {
  minDepositAmount: number;
  maxDepositAmount: number;
  minWithdrawalAmount: number;
  maxWithdrawalAmount: number;
}
