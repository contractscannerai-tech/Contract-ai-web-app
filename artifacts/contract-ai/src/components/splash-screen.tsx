import { useState, useEffect } from "react";
import { FileText } from "lucide-react";

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<"logo" | "trusted" | "done">("logo");

  useEffect(() => {
    // Fade out the CSS pre-splash that rendered before JS loaded,
    // so the React animation takes over seamlessly.
    const preSplash = document.getElementById("pre-splash");
    if (preSplash) {
      preSplash.classList.add("ps-fade");
      setTimeout(() => preSplash.remove(), 300);
    }

    const t1 = setTimeout(() => setPhase("trusted"), 2500);
    const t2 = setTimeout(() => {
      setPhase("done");
      onComplete();
    }, 4000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onComplete]);

  if (phase === "done") return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background">
      <div className={`flex flex-col items-center transition-all duration-700 ${phase === "logo" ? "scale-100 opacity-100" : "scale-95 opacity-80"}`}>
        <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mb-6 animate-pulse shadow-lg">
          <FileText className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground mb-2">ContractAI</h1>
        <div className="w-16 h-1 bg-primary rounded-full mb-6" />
      </div>

      <p className={`text-sm text-muted-foreground mt-4 transition-all duration-700 ${phase === "trusted" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        Trusted by 10,000+ professionals worldwide
      </p>
    </div>
  );
}
