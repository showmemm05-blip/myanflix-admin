export type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Withdrawal {
  id: string;
  userId: string;
  userName: string;
  userPhone: string | null;
  amount: number;
  /** The account the user provided to receive the money — never edited by admins. */
  accountType: string;
  accountName: string;
  accountNumber: string;
  status: WithdrawalStatus;
  rejectionReason: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  /** The account WE sent the money from — recorded manually by an admin after approval. */
  transferAccountType: string | null;
  transferAccountName: string | null;
  transferAccountNumber: string | null;
  createdAt: string;
  updatedAt: string;
}
