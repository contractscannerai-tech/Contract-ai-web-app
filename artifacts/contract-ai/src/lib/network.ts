import { useEffect, useState } from "react";

let _online = typeof navigator === "undefined" ? true : navigator.onLine;
const listeners = new Set<(online: boolean) => void>();

function emit(next: boolean) {
  if (next === _online) return;
  _online = next;
  for (const cb of listeners) cb(next);
}

let _initialized = false;

export function initNetworkMonitor(): void {
  if (_initialized || typeof window === "undefined") return;
  _initialized = true;
  window.addEventListener("online", () => emit(true));
  window.addEventListener("offline", () => emit(false));
}

export function isOnline(): boolean {
  return _online;
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(_online);
  useEffect(() => {
    const cb = (next: boolean) => setOnline(next);
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);
  return online;
}

export class OfflineError extends Error {
  constructor() {
    super("You're offline. Please check your internet connection and try again.");
    this.name = "OfflineError";
  }
}

let _toastFn: ((opts: { title: string; description?: string; variant?: "destructive" }) => void) | null = null;
export function registerOfflineToast(fn: typeof _toastFn): void {
  _toastFn = fn;
}

let _lastToastAt = 0;
function showOfflineToast() {
  const now = Date.now();
  if (now - _lastToastAt < 4000) return;
  _lastToastAt = now;
  _toastFn?.({
    title: "Internet connection required",
    description: "You're offline. Connect to the internet and try again.",
    variant: "destructive",
  });
}

export function installFetchGuard(): void {
  if (typeof window === "undefined") return;
  if ((window as unknown as { __caiFetchPatched?: boolean }).__caiFetchPatched) return;
  (window as unknown as { __caiFetchPatched?: boolean }).__caiFetchPatched = true;

  const original = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    if (!_online) {
      showOfflineToast();
      throw new OfflineError();
    }
    try {
      return await original(...args);
    } catch (err) {
      if (err instanceof TypeError && /fetch|network|failed/i.test(err.message)) {
        if (!_online || !navigator.onLine) showOfflineToast();
      }
      throw err;
    }
  };
}
