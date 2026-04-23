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

// Wouter expects an absolute-looking base ("" or "/foo"). Vite's BASE_URL can
// be "/", "./", or a path like "/myapp/" depending on the build mode. Normalize
// all of those to a value wouter accepts without mangling routes.
function normalizeWouterBase(baseUrl: string): string {
  if (!baseUrl || baseUrl === "/" || baseUrl === "./" || baseUrl === ".") return "";
  return baseUrl.replace(/\/$/, "");
}

// Push the current Supabase access token into the server-side sb-session cookie.
// The backend validates it with Supabase Admin and issues a fresh 1-year cookie.
// This keeps the server cookie alive even after Supabase silently refreshes the
// client-side JWT (which it does every ~55 minutes with autoRefreshToken: true).
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
    // Network failure — fail open so the app still loads
  }
}

// Handles OAuth redirects AND keeps the server cookie in sync after every
// silent token refresh by Supabase. Without this, the sb-session cookie
// drifts to an expired JWT after ~1 hour and every API call returns 401.
function AuthRedirector() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        // Keep server cookie current on every auth state change that has a token
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
  // user has an active session AND have refreshed the server cookie. This
  // prevents the landing-page flash AND prevents TermsGate from seeing a 401.
  const [sessionChecked, setSessionChecked] = useState(false);
  const resolvedRef = useRef(false);

  useEffect(() => {
    const base = normalizeWouterBase(import.meta.env.BASE_URL);

    async function resolveSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (resolvedRef.current) return;
        resolvedRef.current = true;

        if (session) {
          // 1. Refresh the server-side sb-session cookie BEFORE the router
          //    mounts, so TermsGate's first API call lands on a valid cookie.
          await syncServerCookie(session.access_token);

          // 2. Rewrite the URL to /dashboard so Wouter starts there directly
          //    — zero flash of the landing page.
          const target = (base || "") + "/dashboard";
          if (!window.location.pathname.includes("/dashboard")) {
            window.history.replaceState({}, "", target);
          }
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

  const handleSplashComplete = useCallback(() => {
    sessionStorage.setItem("contractai_splash_done", "1");
    setSplashDone(true);
  }, []);

  // Router only mounts when BOTH the animation is done AND the session/cookie
  // sync is complete — guaranteeing the right starting page with no glitches.
  const isReady = splashDone && sessionChecked;

  return (
    <NetworkGuardProvider>
      <NetworkBanner />
      {/* Splash covers everything while the animation plays */}
      {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
      {/* Invisible placeholder while session resolves (imperceptibly brief) */}
      {splashDone && !sessionChecked && <div className="min-h-screen bg-background" />}
      {isReady && (
        <WouterRouter base={normalizeWouterBase(import.meta.env.BASE_URL)}>
          <AuthRedirector />
          <Router />
        </WouterRouter>
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
