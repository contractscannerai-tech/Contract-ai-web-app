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

function AuthRedirector() {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // On mount: recover any persisted session from localStorage and redirect
    // away from the login page if the user is already authenticated.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && location === "/auth") {
        setLocation("/dashboard", { replace: true });
      }
    });

    // Also handle real-time auth events (OAuth callback, token refresh, etc.)
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
        session &&
        location === "/auth"
      ) {
        setLocation("/dashboard", { replace: true });
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleSplashComplete = useCallback(() => {
    sessionStorage.setItem("contractai_splash_done", "1");
    setSplashDone(true);
  }, []);

  return (
    <NetworkGuardProvider>
      <NetworkBanner />
      {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
      {splashDone && (
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
