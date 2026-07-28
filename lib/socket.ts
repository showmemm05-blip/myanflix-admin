import { io, type Socket } from "socket.io-client";
import { API_ORIGIN } from "@/services/api/apiClient";

/**
 * Singleton Socket.IO client shared across the app. Connected on
 * login/session-restore and disconnected on logout by role-context.tsx —
 * components just call getSocket() and attach/detach their own listeners.
 */
let socket: Socket | null = null;
let socketToken: string | null = null;

export function connectSocket(token: string): Socket {
  if (socket?.connected && socketToken === token) return socket;

  socket?.disconnect();
  socketToken = token;
  socket = io(API_ORIGIN, {
    auth: { token },
    transports: ["websocket"],
  });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}
