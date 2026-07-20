"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authService } from "@/services/api/authService";
import { userService } from "@/services/api/userService";
import { ApiError } from "@/services/api/apiClient";
import { onUnauthorized, tokenStore } from "@/lib/auth/token-store";
import { ROLE_LABELS, type AppUser, type UserRole } from "@/types/user";

/**
 * Real authenticated session backed by the NestJS API — JWT access +
 * refresh tokens are persisted in localStorage via `tokenStore`, and
 * `apiClient` calls `notifyUnauthorized()` if a refresh attempt fails,
 * which this provider listens for to force a logout.
 *
 * `currentUser` is the full enriched profile (balance, avatar, etc.) from
 * GET /users/me — the lightweight {id,email,username,role} returned by
 * /auth/login only carries identity, not wallet/spend stats.
 */

const EMPTY_USER: AppUser = {
  id: "",
  name: "",
  email: "",
  avatarUrl: "",
  role: "USER",
  status: "ACTIVE",
  balance: 0,
  totalDeposited: 0,
  totalSpent: 0,
  moviesPurchased: 0,
  joinDate: "",
};

interface RoleContextValue {
  role: UserRole;
  currentUser: AppUser;
  roleLabel: string;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isAdminOrAbove: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tokenStore.getAccessToken()) {
      setIsLoading(false);
      return;
    }

    userService
      .getMe()
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => onUnauthorized(() => setCurrentUser(null)), []);

  const login = useCallback(async (email: string, password: string) => {
    const { user, accessToken, refreshToken } = await authService.login(email, password);
    tokenStore.setSession(accessToken, refreshToken, user);
    const profile = await userService.getMe();
    setCurrentUser(profile);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.getRefreshToken();
    tokenStore.clear();
    setCurrentUser(null);
    if (refreshToken) {
      try {
        await authService.logout(refreshToken);
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
      }
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const profile = await userService.getMe();
    setCurrentUser(profile);
  }, []);

  const value = useMemo<RoleContextValue>(() => {
    const role = currentUser?.role ?? "USER";
    return {
      role,
      currentUser: currentUser ?? EMPTY_USER,
      roleLabel: ROLE_LABELS[role],
      isSuperAdmin: role === "SUPER_ADMIN",
      isAdmin: role === "ADMIN",
      isAdminOrAbove: role === "SUPER_ADMIN" || role === "ADMIN",
      isAuthenticated: currentUser !== null,
      isLoading,
      login,
      logout,
      refreshProfile,
    };
  }, [currentUser, isLoading, login, logout, refreshProfile]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within a RoleProvider");
  return ctx;
}
