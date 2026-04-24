import { useState, useCallback, useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n";
import { SplashScreen } from "@/components/splash-screen";
import { TermsGate } from "@/components/terms-gate";
import { IntegrityGuard } from "@/components/integrity-guard";
import { NetworkBanner } from "@/components/network-banner";
import { NetworkGuardProvider } from "@/components/network-guard";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import AuthPage from "@/pages/auth";
import AuthCallbackPage from "@/pages/auth-callback";
import DashboardPage from "@/pages/dashboard";
import ContractsPage from "@/pages/contracts";
import UploadPage from "@/pages/upload";
import ContractDetailPage from "@/pages/contract-detail";
import PricingPage from "@/pages/pricing";
import SettingsPage from "@/pages/settings";
import PrivacyPage from "@/pages/privacy";
import TermsPage from "@/pages/terms";
import DraftDocumentPage from "@/pages/ai/draft-document";
import ApplicationPage from "@/pages/ai/application";
import ResumePage from "@/pages/ai/resume";
import CareerPage from "@/pages/ai/career";
import TemplatesPage from "@/pages/ai/templates";
import LeaderboardPage from "@/pages/leaderboard";
import HistoryPage from "@/pages/history";
import TeamPage from "@/pages/team";
import TeamJoinPage from "@/pages/team-join";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function Gated({ children }: { children: React.ReactNode }) {
  return <TermsGate>{children}</TermsGate>;
}

function normalizeWouterBase(baseUrl: string): string {
  if (!baseUrl || baseUrl === "/" || baseUrl === "./" || baseUrl === ".") return "";
  return baseUrl.replace(/\/$/, "");
}

// Push the current Supabase access token into the server-side sb-session cookie.
async function syncServerCookie(accessToken: string): Promise<void> {
  try {
    const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
    await fetch(`${base}/api/auth/oauth-session`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: accessToken }),
    });
  } catch {
    // Network failure — fail open
  }
}

// Handles OAuth redirects AND keeps the server cookie in sync after every
// silent token refresh by Supabase.
function AuthRedirector() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        void syncServerCookie(session.access_token);
      }
      if (event === "SIGNED_IN" && session) {
        setLocation("/dashboard", { replace: true });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [setLocation]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/auth/callback" component={AuthCallbackPage} />
      <Route path="/dashboard">{() => <Gated><DashboardPage /></Gated>}</Route>
      <Route path="/contracts/upload">{() => <Gated><UploadPage /></Gated>}</Route>
      <Route path="/contracts/:id">{(params) => <Gated><ContractDetailPage {...params} /></Gated>}</Route>
      <Route path="/contracts">{() => <Gated><ContractsPage /></Gated>}</Route>
      <Route path="/pricing" component={PricingPage} />
      <Route path="/settings">{() => <Gated><SettingsPage /></Gated>}</Route>
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/ai/draft">{() => <Gated><DraftDocumentPage /></Gated>}</Route>
      <Route path="/ai/application">{() => <Gated><ApplicationPage /></Gated>}</Route>
      <Route path="/ai/resume">{() => <Gated><ResumePage /></Gated>}</Route>
      <Route path="/ai/career">{() => <Gated><CareerPage /></Gated>}</Route>
      <Route path="/ai/templates">{() => <Gated><TemplatesPage /></Gated>}</Route>
      <Route path="/leaderboard">{() => <Gated><LeaderboardPage /></Gated>}</Route>
      <Route path="/history">{() => <Gated><HistoryPage /></Gated>}</Route>
      <Route path="/team">{() => <Gated><TeamPage /></Gated>}</Route>
      <Route path="/team/join" component={TeamJoinPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppGate() {
  const [splashDone, setSplashDone] = useState(() => {
    return sessionStorage.getItem("contractai_splash_done") === "1";
  });

  // sessionChecked gates the router from mounting until we know whether the
  // user has an active session AND have refreshed the server cookie.
  const [sessionChecked, setSessionChecked] = useState(false);

  // Shown while we reconnect and sync the session cookie after going offline.
  const [isReconnecting, setIsReconnecting] = useState(false);

  const resolvedRef = useRef(false);
  const hadSessionRef = useRef(false);

  useEffect(() => {
    async function resolveSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (resolvedRef.current) return;
        resolvedRef.current = true;

        if (session) {
          hadSessionRef.current = true;

          if (navigator.onLine) {
            // Online: sync the server cookie FIRST, then redirect to dashboard.
            await syncServerCookie(session.access_token);
            const base = normalizeWouterBase(import.meta.env.BASE_URL);
            const target = (base || "") + "/dashboard";
            if (!window.location.pathname.includes("/dashboard")) {
              window.history.replaceState({}, "", target);
            }
          }
          // Offline with a session: stay on landing page.
          // The reconnect watcher below will handle the redirect when internet returns.
        }
      } catch {
        if (!resolvedRef.current) resolvedRef.current = true;
      } finally {
        setSessionChecked(true);
      }
    }

    void resolveSession();

    // Safety net: never block the app for more than 5 seconds.
    const timeout = setTimeout(() => {
      if (!resolvedRef.current) {
        resolvedRef.current = true;
        setSessionChecked(true);
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, []);

  // When internet returns AND the user had an active session, sync the cookie
  // and navigate them straight to dashboard.
  useEffect(() => {
    async function handleReconnect() {
      if (!hadSessionRef.current) return;
      setIsReconnecting(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await syncServerCookie(session.access_token);
          const base = normalizeWouterBase(import.meta.env.BASE_URL);
          window.location.href = (base || "") + "/dashboard";
          return;
        }
      } catch { /* ignore */ }
      setIsReconnecting(false);
    }

    window.addEventListener("online", handleReconnect);
    return () => window.removeEventListener("online", handleReconnect);
  }, []);

  const handleSplashComplete = useCallback(() => {
    sessionStorage.setItem("contractai_splash_done", "1");
    setSplashDone(true);
  }, []);

  const isReady = splashDone && sessionChecked;

  return (
    <NetworkGuardProvider>
      <NetworkBanner />

      {/* Splash covers everything while the animation plays */}
      {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}

      {/* Blank hold while session resolves after splash */}
      {splashDone && !sessionChecked && <div className="min-h-screen bg-background" />}

      {isReady && (
        <WouterRouter base={normalizeWouterBase(import.meta.env.BASE_URL)}>
          <AuthRedirector />
          <Router />
        </WouterRouter>
      )}

      {/* Reconnect overlay — shown briefly while syncing session after going offline */}
      {isReconnecting && (
        <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
          <p className="text-sm font-medium text-foreground">Connecting you to your contracts…</p>
        </div>
      )}

      <Toaster />
      <IntegrityGuard />
    </NetworkGuardProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <I18nProvider>
            <AppGate />
          </I18nProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
