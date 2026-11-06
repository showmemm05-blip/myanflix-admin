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
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { onUnauthorized, tokenStore } from "@/lib/auth/token-store";
import { useLanguage } from "@/lib/context/language-context";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import type { Permission } from "@/lib/permissions";
import { ROLE_LABELS, type AuthenticatedProfile, type UserRole } from "@/types/user";

/**
 * Real authenticated session backed by the NestJS API — JWT access +
 * refresh tokens are persisted in localStorage via `tokenStore`, and
 * `apiClient` calls `notifyUnauthorized()` when the server REFUSES a
 * refresh (never when it merely could not be reached), which this provider
 * listens for to force a logout.
 *
 * `currentUser` is the full enriched profile (balance, avatar, etc.) from
 * GET /users/me — the lightweight {id,username,role} returned by
 * /auth/login only carries identity, not wallet/spend stats.
 *
 * It also carries the caller's *effective permission set*, resolved
 * server-side from their assigned AppRole. Everything the admin gates on —
 * the sidebar, page access, every action button — goes through `can()` /
 * `canAny()` here; no component may branch on a role name. Because
 * `JwtStrategy` re-reads the user on every request and the backend resolves
 * permissions from the DB, a role edit takes effect on the next
 * `refreshProfile()` with no re-login.
 */

const EMPTY_USER: AuthenticatedProfile = {
  id: "",
  name: "",
  username: "",
  displayName: null,
  phone: null,
  avatarUrl: null,
  role: "USER",
  status: "ACTIVE",
  balance: 0,
  totalDeposited: 0,
  totalSpent: 0,
  isSubscribed: false,
  subscriptionExpiresAt: null,
  joinDate: "",
  permissions: [],
  roleName: ROLE_LABELS.USER,
};

interface RoleContextValue {
  /** Coarse account kind (USER vs staff) — for display only, never a gate. */
  role: UserRole;
  currentUser: AuthenticatedProfile;
  /** The assigned AppRole's display name, e.g. "Super Admin", "Movie Manager". */
  roleName: string;
  /** The caller's effective permission set, as returned by GET /users/me. */
  permissions: readonly Permission[];
  /** True when the caller holds this exact permission. */
  can: (permission: Permission) => boolean;
  /** True when the caller holds at least one of these permissions. */
  canAny: (permissions: readonly Permission[]) => boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

/**
 * A boot failure that says nothing about the session: the API could not be
 * reached (status 0 — offline, DNS, the client's 20 s timeout), answered
 * 5xx while it restarts, or 408/429 (a proxy timeout, the rate limit every
 * tab on this IP shares) — the statuses the website's isTransientStatus
 * calls "no verdict" too. The tokens are kept and a Retry screen stands in
 * for the app until GET /users/me answers (audit FE-001). Anything else —
 * a 401/403 verdict — lands on the login page as before.
 */
function isTransientBootFailure(error: unknown): error is ApiError {
  if (!(error instanceof ApiError)) return false;
  const { status } = error;
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

/** Full-screen stand-in for the app while the boot request could not reach the API. */
function BootRetryScreen({ onRetry, onLogOut }: { onRetry: () => void; onLogOut: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background p-6">
      <ErrorState
        className="w-full max-w-md"
        title={t.shared.serverUnreachableTitle}
        description={t.shared.serverUnreachableDescription}
        onRetry={onRetry}
      />
      <Button variant="ghost" size="sm" onClick={onLogOut}>
        {t.common.logOut}
      </Button>
    </div>
  );
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthenticatedProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bootError, setBootError] = useState<ApiError | null>(null);
  // Bumped by Retry on the screen above: runs the boot effect again.
  const [bootAttempt, setBootAttempt] = useState(0);

  useEffect(() => {
    const accessToken = tokenStore.getAccessToken();
    if (!accessToken) {
      // The token lives in browser storage, which only exists after mount;
      // with none there is nothing to load. Runs once, so no cascade.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    connectSocket(accessToken);
    userService
      .getMe()
      .then((profile) => {
        if (!cancelled) setCurrentUser(profile);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (isTransientBootFailure(error)) setBootError(error);
        else setCurrentUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bootAttempt]);

  const retryBoot = useCallback(() => {
    setBootError(null);
    setIsLoading(true);
    setBootAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(
    () =>
      onUnauthorized(() => {
        setCurrentUser(null);
        disconnectSocket();
      }),
    []
  );

  const login = useCallback(async (username: string, password: string) => {
    const { user, accessToken, refreshToken } = await authService.login(username, password);
    tokenStore.setSession(accessToken, refreshToken, user);
    connectSocket(accessToken);
    const profile = await userService.getMe();
    setCurrentUser(profile);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.getRefreshToken();
    tokenStore.clear();
    setCurrentUser(null);
    disconnectSocket();
    if (refreshToken) {
      try {
        await authService.logout(refreshToken);
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
      }
    }
  }, []);

  /** "Log out" on the Retry screen: the way out when the API stays down. */
  const leaveSession = useCallback(async () => {
    setBootError(null);
    await logout();
  }, [logout]);

  const refreshProfile = useCallback(async () => {
    const profile = await userService.getMe();
    setCurrentUser(profile);
  }, []);

  const value = useMemo<RoleContextValue>(() => {
    const profile = currentUser ?? EMPTY_USER;
    // A Set so `can()` is O(1) even on the Super Admin's 61-entry set, and
    // so it stays referentially stable across renders for effect deps.
    const granted = new Set<Permission>(profile.permissions);
    const can = (permission: Permission) => granted.has(permission);
    return {
      role: profile.role,
      currentUser: profile,
      roleName: profile.roleName,
      permissions: profile.permissions,
      can,
      canAny: (permissions) => permissions.some(can),
      isAuthenticated: currentUser !== null,
      isLoading,
      login,
      logout,
      refreshProfile,
    };
  }, [currentUser, isLoading, login, logout, refreshProfile]);

  return (
    <RoleContext.Provider value={value}>
      {bootError ? <BootRetryScreen onRetry={retryBoot} onLogOut={leaveSession} /> : children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within a RoleProvider");
  return ctx;
}
