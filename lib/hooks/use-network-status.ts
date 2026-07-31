import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@/services/api/apiClient";

// While offline, probe fast so a restored connection is noticed quickly;
// while online, probe slowly just as a backstop against navigator.onLine's
// well-known blind spot (it reports true whenever a network interface is
// up, even with zero real internet — e.g. Wi-Fi connected, router offline).
const OFFLINE_POLL_MS = 4000;
const ONLINE_POLL_MS = 20000;
const PROBE_TIMEOUT_MS = 4000;

/** A real reachability check against our own backend, not just "is some network interface up." */
async function probeServer(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal, cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * True internet connectivity, not just `navigator.onLine` — backed by
 * actually reaching our own backend's /health endpoint. Reacts immediately
 * to the browser's online/offline events (fast signal for real network
 * interface changes) and continuously re-probes in the background
 * (the reliable way to both catch "interface up, no real internet" and to
 * notice the moment a real connection comes back).
 */
export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      const ok = await probeServer();
      if (cancelledRef.current) return;
      setIsOnline(ok);
      timer = setTimeout(tick, ok ? ONLINE_POLL_MS : OFFLINE_POLL_MS);
    };
    void tick();

    // The browser's own offline event is a fast, reliable signal for a
    // genuine network-interface change — no need to wait for the next poll.
    const handleOffline = () => setIsOnline(false);
    // Its online event is optimistic (interface up, not necessarily real
    // internet) — re-probe immediately rather than trusting it outright.
    const handleOnline = () => {
      clearTimeout(timer);
      void tick();
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      cancelledRef.current = true;
      clearTimeout(timer);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return isOnline;
}
