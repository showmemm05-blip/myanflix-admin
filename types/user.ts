export type UserRole = "SUPER_ADMIN" | "ADMIN" | "USER" | "CONTENT_UPLOADER";

export type UserStatus = "ACTIVE" | "SUSPENDED" | "BANNED";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: UserRole;
  status: UserStatus;
  balance: number;
  totalDeposited: number;
  totalSpent: number;
  isSubscribed: boolean;
  subscriptionExpiresAt: string | null;
  joinDate: string;
}

export interface WatchHistoryEntry {
  id: string;
  movieId: string;
  movieTitle: string;
  posterUrl: string | null;
  watchedAt: string;
  progressPercent: number;
  durationMinutes: number | null;
}

export interface PurchaseEntry {
  id: string;
  movieId: string;
  movieTitle: string;
  posterUrl: string | null;
  price: number;
  purchasedAt: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  USER: "User",
  CONTENT_UPLOADER: "Content Uploader",
};

export const STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  BANNED: "Banned",
};
