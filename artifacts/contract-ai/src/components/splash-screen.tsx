import { useEffect } from "react";

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    // Fade out the CSS pre-splash that was visible before JS loaded.
    // This creates a seamless handoff — no blank frame ever.
    const preSplash = document.getElementById("pre-splash");
    if (preSplash) {
      preSplash.classList.add("ps-fade");
      setTimeout(() => preSplash.remove(), 300);
    }

    // Let the animation breathe for 2.2 s then hand off to the router.
    const t = setTimeout(() => onComplete(), 2200);
    return () => clearTimeout(t);
  }, [onComplete]);

  // The CSS pre-splash already covers the screen with the animation,
  // so React doesn't need to render anything — it just waits.
  return null;
}
