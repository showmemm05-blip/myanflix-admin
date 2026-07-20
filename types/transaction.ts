export type TransactionType = "DEPOSIT" | "PURCHASE" | "REFUND";

export type TransactionStatus = "PENDING" | "COMPLETED" | "FAILED";

export interface Transaction {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl: string;
  movieId: string | null;
  movieTitle: string | null;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  createdAt: string;
}
