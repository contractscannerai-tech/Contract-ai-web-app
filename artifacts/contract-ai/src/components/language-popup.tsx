import { useState } from "react";
import { LANGUAGES, useI18n, type LangCode } from "@/lib/i18n";

export function LanguagePopup({ onComplete }: { onComplete: () => void }) {
  const { setLang } = useI18n();
  const [selected, setSelected] = useState<LangCode>("en");

  function handleContinue() {
    setLang(selected);
    onComplete();
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-card-border rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">
        <div className="text-center mb-6">
          <div className="text-3xl mb-3">{"\u{1F30D}"}</div>
          <h2 className="text-xl font-bold text-foreground mb-1">Welcome to ContractAI</h2>
          <p className="text-sm text-muted-foreground">Select your preferred language to continue</p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-6">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setSelected(lang.code)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                selected === lang.code
                  ? "bg-primary text-primary-foreground border-primary shadow-md"
                  : "bg-background border-border hover:bg-muted"
              }`}
            >
              <span className="text-lg">{lang.flag}</span>
              <span>{lang.name}</span>
            </button>
          ))}
        </div>

        <button
          onClick={handleContinue}
          className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
