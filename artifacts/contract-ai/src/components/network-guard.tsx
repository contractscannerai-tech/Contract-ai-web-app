import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { Wifi, WifiOff, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type GuardState = {
  isOnline: boolean;
  requireOnline: (action?: string) => boolean;
};

const NetworkGuardContext = createContext<GuardState | null>(null);

export function NetworkGuardProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [showModal, setShowModal] = useState(false);
  const [blockedAction, setBlockedAction] = useState<string>("AI feature");

  useEffect(() => {
    const on = () => {
      setIsOnline(true);
      setShowModal(false);
    };
    const off = () => {
      setIsOnline(false);
      setBlockedAction("this secure feature");
      setShowModal(true);
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const requireOnline = useCallback((action?: string) => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setBlockedAction(action || "this secure feature");
      setShowModal(true);
      return false;
    }
    return true;
  }, []);

  return (
    <NetworkGuardContext.Provider value={{ isOnline, requireOnline }}>
      {children}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md border-primary/30 bg-gradient-to-b from-background to-primary/5" data-testid="dialog-network-guard">
          <DialogHeader>
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <WifiOff className="w-7 h-7 text-primary" />
            </div>
            <DialogTitle className="text-center text-xl">Secure Connection Required</DialogTitle>
            <DialogDescription className="text-center pt-2 leading-relaxed">
              {blockedAction === "this secure feature"
                ? "This AI feature requires internet access to communicate with our encrypted servers."
                : `${blockedAction} requires internet access to communicate with our encrypted servers.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <p>Your contracts are processed on encrypted servers. We never analyze documents on-device, so an active connection is needed to keep your data secure.</p>
          </div>
          <Button onClick={() => setShowModal(false)} className="w-full gap-2" data-testid="button-network-guard-dismiss">
            <Wifi className="w-4 h-4" />
            Got it
          </Button>
        </DialogContent>
      </Dialog>
    </NetworkGuardContext.Provider>
  );
}

export function useNetworkGuard(): GuardState {
  const ctx = useContext(NetworkGuardContext);
  if (!ctx) {
    return {
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      requireOnline: () => true,
    };
  }
  return ctx;
}
