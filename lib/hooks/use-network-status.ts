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
 * interface changes) and re-probes in the background (the reliable way to
 * both catch "interface up, no real internet" and to notice the moment a
 * real connection comes back).
 *
 * Only one probe runs at a time: an `online` event that arrives while a
 * probe is still waiting just asks for one more probe right after it,
 * instead of starting a second, parallel polling loop.
 *
 * While the tab is hidden the probing pauses (one fresh probe runs the
 * moment it is visible again) — unless `keepPollingWhileHidden` is true,
 * which the upload queue sets while it has work, so an upload left running
 * in a background tab still notices a drop and resumes on its own. When
 * that flag turns on, one probe runs straight away so the status is fresh
 * before the first upload starts.
 */
export function useNetworkStatus(keepPollingWhileHidden = false): boolean {
  const [isOnline, setIsOnline] = useState(true);
  const keepPollingRef = useRef(keepPollingWhileHidden);
  const kickRef = useRef<() => void>(() => {});

  useEffect(() => {
    keepPollingRef.current = keepPollingWhileHidden;
  }, [keepPollingWhileHidden]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    let probeAgain = false;

    const paused = () => document.visibilityState === "hidden" && !keepPollingRef.current;

    const tick = async () => {
      clearTimeout(timer);
      timer = undefined;
      if (inFlight) {
        probeAgain = true;
        return;
      }
      if (paused()) return; // resumed by the visibilitychange handler below
      inFlight = true;
      probeAgain = false;
      let ok: boolean;
      try {
        ok = await probeServer();
      } finally {
        inFlight = false;
      }
      if (cancelled) return;
      setIsOnline(ok);
      if (probeAgain) {
        void tick();
        return;
      }
      timer = setTimeout(tick, ok ? ONLINE_POLL_MS : OFFLINE_POLL_MS);
    };
    kickRef.current = () => void tick();
    void tick();

    // The browser's own offline event is a fast, reliable signal for a
    // genuine network-interface change — no need to wait for the next poll.
    const handleOffline = () => setIsOnline(false);
    // Its online event is optimistic (interface up, not necessarily real
    // internet) — re-probe immediately rather than trusting it outright.
    const handleOnline = () => void tick();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void tick();
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      kickRef.current = () => {};
      clearTimeout(timer);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Work just arrived (e.g. a queue started): probe once now.
  useEffect(() => {
    if (keepPollingWhileHidden) kickRef.current();
  }, [keepPollingWhileHidden]);

  return isOnline;
}
