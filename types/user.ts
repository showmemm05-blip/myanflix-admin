import type { Permission } from "@/lib/permissions";

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "USER" | "CONTENT_UPLOADER";

export type UserStatus = "ACTIVE" | "SUSPENDED" | "BANNED";

export interface AppUser {
  id: string;
  /**
   * The resolved label to render — `userLabel()` output, i.e. the display name
   * the user set, falling back to `username`. Never render `username` in its
   * place; never render it raw where this exists.
   */
  name: string;
  /** The raw login identity, kept verbatim so staff can still see who an account is. */
  username: string;
  /** The name the user chose for themselves; null until they set one. */
  displayName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  balance: number;
  totalDeposited: number;
  totalSpent: number;
  isSubscribed: boolean;
  subscriptionExpiresAt: string | null;
  joinDate: string;
}

/**
 * The signed-in caller. Extends the plain profile with the RBAC state only
 * `GET /users/me` returns — the effective permission set every `can()` call
 * in the admin resolves against, plus the assigned role's display name.
 */
export interface AuthenticatedProfile extends AppUser {
  permissions: Permission[];
  /** `AppRole.name`, e.g. "Super Admin" or a custom role's own name. */
  roleName: string;
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
