import { apiClient } from "./apiClient";
import type { UserRole } from "@/types/user";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type LoginResponse = { user: AuthUser } & AuthTokens;

export const authService = {
  login(username: string, password: string) {
    return apiClient.post<LoginResponse>("/auth/login", { username, password }, { skipAuth: true });
  },

  register(username: string, email: string, password: string) {
    return apiClient.post<LoginResponse>(
      "/auth/register",
      { username, email, password },
      { skipAuth: true },
    );
  },

  logout(refreshToken: string) {
    return apiClient.post<{ loggedOut: boolean }>(
      "/auth/logout",
      { refreshToken },
      { skipAuth: true },
    );
  },
};
