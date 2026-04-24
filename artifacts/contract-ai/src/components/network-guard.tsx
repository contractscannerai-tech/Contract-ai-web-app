import {
  createContext, useCallback, useContext, useEffect, useState, ReactNode,
} from "react";
import { WifiOff, Wifi } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type GuardState = {
  isOnline: boolean;
  requireOnline: (action?: string) => boolean;
  showOfflineModal: (action?: string) => void;
};

const NetworkGuardContext = createContext<GuardState | null>(null);

const MESSAGES: Record<string, { title: string; body: string }> = {
  "sign in": {
    title: "One quick thing first",
    body: "Your contracts are waiting on the other side — connect to the internet and let's get you in.",
  },
  "sign up": {
    title: "Almost there",
    body: "You're one connection away from contract clarity. Get online and make it official.",
  },
  "checkout": {
    title: "Payments need a live line",
    body: "Even the best contracts can't execute offline. Connect and complete your upgrade — your clauses are counting on you.",
  },
  _default: {
    title: "No connection detected",
    body: "This part of ContractAI is waiting for you to come back online. Think of it as the digital equivalent of a notary stamp — some things just need to be done live.",
  },
};

function getMessage(action?: string) {
  if (!action) return MESSAGES._default!;
  const key = action.toLowerCase();
  for (const k of Object.keys(MESSAGES)) {
    if (key.includes(k)) return MESSAGES[k]!;
  }
  return {
    title: "Connection required",
    body: `"${action}" needs a live connection. Your contracts will be right here the moment you're back online.`,
  };
}

export function NetworkGuardProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [showModal, setShowModal] = useState(false);
  const [blockedAction, setBlockedAction] = useState<string | undefined>(undefined);

  useEffect(() => {
    const on = () => { setIsOnline(true); setShowModal(false); };
    const off = () => { setIsOnline(false); };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const showOfflineModal = useCallback((action?: string) => {
    setBlockedAction(action);
    setShowModal(true);
  }, []);

  const requireOnline = useCallback((action?: string): boolean => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      showOfflineModal(action);
      return false;
    }
    return true;
  }, [showOfflineModal]);

  const msg = getMessage(blockedAction);

  return (
    <NetworkGuardContext.Provider value={{ isOnline, requireOnline, showOfflineModal }}>
      {children}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent
          className="sm:max-w-sm border-primary/20 bg-gradient-to-b from-background to-primary/5 text-center"
          data-testid="dialog-network-guard"
        >
          <DialogHeader>
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <WifiOff className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle className="text-center text-lg">{msg.title}</DialogTitle>
            <DialogDescription className="text-center pt-1.5 leading-relaxed text-sm">
              {msg.body}
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={() => setShowModal(false)}
            className="w-full gap-2 mt-1"
            data-testid="button-network-guard-dismiss"
          >
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
      showOfflineModal: () => {},
    };
  }
  return ctx;
}
