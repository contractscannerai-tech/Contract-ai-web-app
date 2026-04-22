import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

const SESSION_KEY = "contractai_greeted";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Props {
  userName?: string;
}

export function WelcomeBackDialog({ userName }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    // Only show once per browser session
    if (sessionStorage.getItem(SESSION_KEY) === "1") return;
    if (fetched.current) return;
    fetched.current = true;

    const name = encodeURIComponent(userName ?? "");
    fetch(`${BASE}/api/greetings?name=${name}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data: { message?: string }) => {
        setMessage(data.message ?? "");
        setLoading(false);
        setOpen(true);
        sessionStorage.setItem(SESSION_KEY, "1");
      })
      .catch(() => {
        setLoading(false);
      });
  }, [userName]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm border-primary/20 bg-gradient-to-b from-background to-primary/5 text-center p-8 gap-0">
        {/* Pulsing icon */}
        <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-primary animate-pulse" />
        </div>

        <p className="text-xs font-semibold tracking-widest text-primary/70 uppercase mb-3">
          Welcome back{userName ? `, ${userName.split(" ")[0]}` : ""}
        </p>

        {loading ? (
          <div className="space-y-2 mb-6">
            <div className="h-4 bg-muted rounded animate-pulse w-full" />
            <div className="h-4 bg-muted rounded animate-pulse w-4/5 mx-auto" />
          </div>
        ) : (
          <p className="text-base leading-relaxed text-foreground/80 mb-6 font-medium">
            {message}
          </p>
        )}

        <Button
          onClick={() => setOpen(false)}
          className="w-full"
          size="sm"
        >
          Let's go
        </Button>
      </DialogContent>
    </Dialog>
  );
}
