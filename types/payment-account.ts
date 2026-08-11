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
  accountName: string;
  accountNumber: string;
  bankName: string | null;
  note: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: PaymentAccountStaffRef | null;
  updatedBy: PaymentAccountStaffRef | null;
}

export interface PaymentAccountFormValues {
  type: string;
  accountName: string;
  accountNumber: string;
  bankName?: string;
  note?: string;
  isActive?: boolean;
}
