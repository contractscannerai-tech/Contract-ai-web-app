import { useState, useCallback, useEffect } from "react";
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

// Handles OAuth redirects only — session recovery on load is handled in AppGate
// before the router mounts, so there is never a flash of the wrong page.
function AuthRedirector() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
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

  // Check the session while the splash is still showing so we know exactly
  // where to land *before* the router ever mounts. This prevents any flash of
  // the landing page for users who are already logged in.
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Rewrite the browser URL to /dashboard before Wouter reads it.
        // The router will start at /dashboard directly — zero flash.
        const base = normalizeWouterBase(import.meta.env.BASE_URL);
        const target = (base || "") + "/dashboard";
        if (!window.location.pathname.includes("/dashboard")) {
          window.history.replaceState({}, "", target);
        }
      }
      setSessionChecked(true);
    });
  }, []);

  const handleSplashComplete = useCallback(() => {
    sessionStorage.setItem("contractai_splash_done", "1");
    setSplashDone(true);
  }, []);

  // Keep the splash visible until BOTH the animation AND the session check
  // are done. This way the router always mounts at the correct URL.
  const isReady = splashDone && sessionChecked;

  return (
    <NetworkGuardProvider>
      <NetworkBanner />
      {/* Splash covers everything while animation plays and session resolves */}
      {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
      {/* Brief blank during session check if splash was already skipped */}
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
