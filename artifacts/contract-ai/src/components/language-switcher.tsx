import { useEffect, useRef, useState } from "react";
import { Globe, Check } from "lucide-react";
import { LANGUAGES, useI18n, type LangCode } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  className?: string;
  variant?: "icon" | "full";
}

export function LanguageSwitcher({ className, variant = "icon" }: LanguageSwitcherProps) {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0]!;

  function pick(code: LangCode) {
    setLang(code);
    setOpen(false);
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
          variant === "icon" ? "" : "border border-border"
        )}
        data-testid="language-switcher-button"
        aria-label="Change language"
      >
        <Globe className="w-4 h-4" />
        {variant === "full" ? (
          <span className="font-medium">{current.nativeName}</span>
        ) : (
          <span className="text-xs uppercase font-medium">{current.code}</span>
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1 w-48 rounded-md border border-border bg-popover shadow-lg z-50 py-1 max-h-80 overflow-auto"
          data-testid="language-switcher-menu"
        >
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => pick(l.code)}
              className={cn(
                "w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-accent",
                l.code === lang && "bg-accent/50"
              )}
              data-testid={`language-option-${l.code}`}
            >
              <span className="flex items-center gap-2">
                <span className="text-base leading-none">{l.flag}</span>
                <span>{l.nativeName}</span>
              </span>
              {l.code === lang && <Check className="w-4 h-4 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
