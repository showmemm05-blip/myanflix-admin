export interface FinanceSettingsStaffRef {
  id: string;
  username: string;
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
