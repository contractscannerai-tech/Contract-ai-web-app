import { useEffect, useState } from "react";
import { Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "contractai_review_prompt_shown_v1";

export function ReviewPromptModal({ trigger }: { trigger: number }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (trigger < 5) return;
    if (localStorage.getItem(STORAGE_KEY) === "1") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const me = await res.json();
        if (me?.reviewPromptShown) {
          localStorage.setItem(STORAGE_KEY, "1");
          return;
        }
        setOpen(true);
      } catch {
        /* silent */
      }
    })();
    return () => { cancelled = true; };
  }, [trigger]);

  async function dismiss(submit: boolean) {
    setSubmitting(true);
    try {
      await fetch("/api/auth/me/review-shown", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submitted: submit,
          rating: submit ? rating : null,
          comment: submit ? comment.trim() : null,
        }),
      }).catch(() => null);
      localStorage.setItem(STORAGE_KEY, "1");
      if (submit) setDone(true);
      else setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 relative shadow-2xl">
        <button
          onClick={() => dismiss(false)}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted"
          aria-label="Dismiss"
          data-testid="review-prompt-close"
        >
          <X className="w-4 h-4" />
        </button>

        {done ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">🙏</div>
            <h3 className="text-lg font-bold mb-1">Thank you!</h3>
            <p className="text-sm text-muted-foreground mb-5">Your feedback helps us make ContractAI better for everyone.</p>
            <Button onClick={() => setOpen(false)}>Close</Button>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-bold mb-1">Enjoying ContractAI?</h3>
            <p className="text-sm text-muted-foreground mb-5">You've analyzed 5 contracts! How are we doing? Your honest feedback helps us improve.</p>

            <div className="flex justify-center gap-1 mb-4" onMouseLeave={() => setHovered(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHovered(n)}
                  className="p-1"
                  data-testid={`review-star-${n}`}
                >
                  <Star
                    className={`w-8 h-8 transition-colors ${
                      (hovered || rating) >= n
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/40"
                    }`}
                  />
                </button>
              ))}
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Anything else? (optional)"
              rows={3}
              className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm resize-none mb-4"
              data-testid="review-comment"
            />

            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => dismiss(false)}
                disabled={submitting}
                className="flex-1"
                data-testid="review-skip"
              >
                Maybe later
              </Button>
              <Button
                onClick={() => dismiss(true)}
                disabled={submitting || rating === 0}
                className="flex-1"
                data-testid="review-submit"
              >
                {submitting ? "Sending..." : "Submit"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
