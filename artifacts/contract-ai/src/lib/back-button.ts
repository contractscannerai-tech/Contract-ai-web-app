import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

// Wires the Android hardware back button to the in-app history. If there's
// nowhere to go back to, the second back-press exits the app (WhatsApp-style
// "press back again to exit"). On non-native (browser) builds this is a no-op.
export function useNativeBackButton(): void {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let lastPressAt = 0;
    let cleanup: (() => void) | null = null;

    let cancelled = false;
    void (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("backButton", () => {
          if (window.history.length > 1) {
            window.history.back();
            return;
          }
          const now = Date.now();
          if (now - lastPressAt < 2000) {
            void App.exitApp();
          } else {
            lastPressAt = now;
            // Lightweight inline toast — avoids importing toast runtime here.
            const el = document.createElement("div");
            el.textContent = "Press back again to exit";
            el.style.cssText = "position:fixed;left:50%;bottom:80px;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:8px 16px;border-radius:9999px;font-size:13px;z-index:10001;pointer-events:none;";
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 1800);
          }
        });
        if (cancelled) {
          handle.remove();
        } else {
          cleanup = () => handle.remove();
        }
      } catch {
        // Plugin unavailable — silently no-op.
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);
}
