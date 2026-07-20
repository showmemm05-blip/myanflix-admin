import type { UserRole } from "@/types/user";

const ACCESS_KEY = "myanflix_access_token";
const REFRESH_KEY = "myanflix_refresh_token";
const USER_KEY = "myanflix_user";

export interface StoredUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
}

function isBrowser() {
  return typeof window !== "undefined";
}

export const tokenStore = {
  getAccessToken(): string | null {
    return isBrowser() ? window.localStorage.getItem(ACCESS_KEY) : null;
  },
  getRefreshToken(): string | null {
    return isBrowser() ? window.localStorage.getItem(REFRESH_KEY) : null;
  },
  getUser(): StoredUser | null {
    if (!isBrowser()) return null;
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredUser;
    } catch {
      return null;
    }
  },
  setSession(accessToken: string, refreshToken: string, user: StoredUser): void {
    if (!isBrowser()) return;
    window.localStorage.setItem(ACCESS_KEY, accessToken);
    window.localStorage.setItem(REFRESH_KEY, refreshToken);
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  updateTokens(accessToken: string, refreshToken: string): void {
    if (!isBrowser()) return;
    window.localStorage.setItem(ACCESS_KEY, accessToken);
    window.localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear(): void {
    if (!isBrowser()) return;
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
    window.localStorage.removeItem(USER_KEY);
  },
};

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();

/** AuthProvider subscribes so a failed token refresh can force a logout. */
export function onUnauthorized(listener: Listener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export function notifyUnauthorized(): void {
  unauthorizedListeners.forEach((listener) => listener());
}
