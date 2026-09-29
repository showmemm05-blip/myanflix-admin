import { io, type Socket } from "socket.io-client";
import { API_ORIGIN, refreshSession } from "@/services/api/apiClient";
import { tokenStore } from "@/lib/auth/token-store";

/**
 * Singleton Socket.IO client shared across the app. Connected on
 * login/session-restore and disconnected on logout by role-context.tsx —
 * components just call getSocket() and attach/detach their own listeners.
 *
 * WHY THE TOKEN IS A FUNCTION. The access token lives 15 minutes. The
 * server verifies it on EVERY handshake, and a reconnect (after a rebuild,
 * a laptop waking, a network blip) that presents the token from login time
 * is refused with a server-side disconnect — which Socket.IO treats as
 * final and never retries. That is how the admin pages went quietly stale
 * "sometimes": every live update stopped until a reload. So the handshake
 * reads the CURRENT token from the store, and a refused handshake refreshes
 * the session through the API client's single-flight path and connects
 * again, with a growing pause so a genuinely dead session cannot spin.
 */
let socket: Socket | null = null;
let refusedInARow = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 60_000;

function scheduleReconnectWithFreshToken(target: Socket): void {
  if (reconnectTimer) return;
  const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** refusedInARow);
  refusedInARow += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void (async () => {
      const token = await refreshSession();
      // Logged out meanwhile, or a different socket took over: stand down.
      if (!token || socket !== target) return;
      target.connect();
    })();
  }, delay);
}

export function connectSocket(token: string): Socket {
  if (socket) {
    if (!socket.connected) socket.connect();
    return socket;
  }
  socket = io(API_ORIGIN, {
    // Read at every (re)connect, not captured once: see the header.
    auth: (cb) => cb({ token: tokenStore.getAccessToken() ?? token }),
    transports: ["websocket"],
  });
  const instance = socket;
  instance.on("connect", () => {
    refusedInARow = 0;
  });
  instance.on("disconnect", (reason) => {
    // Only a server-initiated close needs help: everything else Socket.IO
    // retries by itself with the fresh token the auth callback supplies.
    if (reason === "io server disconnect") scheduleReconnectWithFreshToken(instance);
  });
  return instance;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  refusedInARow = 0;
  socket?.disconnect();
  socket = null;
}

/**
 * For a page that keeps a live list: refetch whenever the socket
 * (re)connects — anything pushed while it was offline was never received —
 * and whenever the tab comes back into view, which is when a laptop wakes.
 * Returns the unsubscribe. Safe to call before the socket exists: the
 * visibility half still works, and the page's effect re-runs after its own
 * fetch, by which time the session has connected.
 */
export function onResync(refetch: () => void): () => void {
  const target = socket;
  const onConnect = () => refetch();
  target?.on("connect", onConnect);
  const onVisible = () => {
    if (document.visibilityState === "visible") refetch();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    target?.off("connect", onConnect);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
