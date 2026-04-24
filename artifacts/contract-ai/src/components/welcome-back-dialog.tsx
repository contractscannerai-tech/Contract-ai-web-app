import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

const SESSION_KEY = "contractai_greeted";
const BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

interface Props {
  userName?: string;
}

export function WelcomeBackDialog({ userName }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === "1") return;
    if (fetched.current) return;
    fetched.current = true;

    const name = encodeURIComponent(userName ?? "");
    fetch(`${BASE}/api/greetings?name=${name}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { message?: string }) => {
        setMessage(data.message ?? "");
        setLoading(false);
        setOpen(true);
        sessionStorage.setItem(SESSION_KEY, "1");
      })
      .catch(() => setLoading(false));
  }, [userName]);

  if (!open) return null;

  const firstName = userName?.split(/[\s@]/)[0];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm border-primary/20 bg-gradient-to-b from-background to-primary/5 p-0 overflow-hidden gap-0">
        {/* Accent strip */}
        <div className="h-1.5 bg-gradient-to-r from-primary/60 via-primary to-primary/60 w-full" />

        <div className="px-7 pt-6 pb-7 text-center">
          {/* Icon */}
          <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>

          {/* Eyebrow */}
          <p className="text-[10px] font-bold tracking-[0.15em] text-primary/60 uppercase mb-2">
            {firstName ? `Back in the courtroom, ${firstName}` : "Back in the courtroom"}
          </p>

          {/* Message body */}
          {loading ? (
            <div className="space-y-2.5 my-5 px-2">
              <div className="h-3.5 bg-muted rounded-full animate-pulse w-full" />
              <div className="h-3.5 bg-muted rounded-full animate-pulse w-5/6 mx-auto" />
            </div>
          ) : (
            <p className="text-[15px] leading-relaxed text-foreground/85 font-medium my-5 px-1">
              {message}
            </p>
          )}

          <Button
            onClick={() => setOpen(false)}
            className="w-full rounded-xl font-semibold"
            size="sm"
          >
            Let's review
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
