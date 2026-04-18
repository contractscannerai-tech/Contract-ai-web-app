import { useState } from "react";
import { ChevronDown, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";

export type ClauseItem = {
  id: string;
  title: string;
  text: string;
  explanation: string;
  riskLevel: "safe" | "caution" | "risky";
  riskReason: string;
};

const STYLES = {
  safe:    { color: "text-green-700 dark:text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", icon: ShieldCheck, label: "Safe" },
  caution: { color: "text-yellow-700 dark:text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", icon: ShieldAlert, label: "Caution" },
  risky:   { color: "text-red-700 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: ShieldX, label: "Risky" },
};

export function ClauseExplorer({ clauses }: { clauses: ClauseItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (!clauses || clauses.length === 0) {
    return <p className="text-sm text-muted-foreground">No clause-by-clause breakdown available.</p>;
  }

  return (
    <div className="space-y-2" data-testid="clause-explorer">
      {clauses.map((c) => {
        const s = STYLES[c.riskLevel] ?? STYLES.safe;
        const Icon = s.icon;
        const isOpen = openId === c.id;
        return (
          <div key={c.id} className={`rounded-lg border ${s.border} ${s.bg} overflow-hidden transition-all`} data-testid={`clause-item-${c.id}`}>
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : c.id)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <Icon className={`w-5 h-5 ${s.color} flex-shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{c.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className={`font-semibold ${s.color}`}>{s.label}</span>
                  {c.riskReason && <span> · {c.riskReason}</span>}
                </p>
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-current/10">
                {c.text && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-3 mb-1">Original wording</p>
                    <p className="text-sm leading-relaxed italic text-foreground/80 bg-background/50 rounded p-3 border border-border/50">{c.text}</p>
                  </div>
                )}
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Plain English</p>
                  <p className="text-sm leading-relaxed">{c.explanation}</p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
