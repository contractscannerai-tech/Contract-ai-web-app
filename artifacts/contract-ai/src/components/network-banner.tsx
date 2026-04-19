import { useEffect } from "react";
import { WifiOff } from "lucide-react";
import { useOnlineStatus, initNetworkMonitor, installFetchGuard, registerOfflineToast } from "@/lib/network";
import { useToast } from "@/hooks/use-toast";

export function NetworkBanner() {
  const online = useOnlineStatus();
  const { toast } = useToast();

  useEffect(() => {
    initNetworkMonitor();
    installFetchGuard();
    registerOfflineToast((opts) => toast(opts));
  }, [toast]);

  if (online) return null;

  return (
    <div
      className="fixed top-0 inset-x-0 z-[10000] bg-destructive text-destructive-foreground text-sm font-medium px-4 py-2 flex items-center justify-center gap-2 shadow-lg"
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
    >
      <WifiOff className="w-4 h-4" />
      <span>Internet connection required — you're offline.</span>
    </div>
  );
}
