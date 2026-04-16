import { useState, useCallback } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n";
import { SplashScreen } from "@/components/splash-screen";
import { LanguagePopup } from "@/components/language-popup";
import { TermsGate } from "@/components/terms-gate";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function Gated({ children }: { children: React.ReactNode }) {
  return <TermsGate>{children}</TermsGate>;
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
      <Route component={NotFound} />
    </Switch>
  );
}

function AppGate() {
  const [splashDone, setSplashDone] = useState(() => {
    return sessionStorage.getItem("contractai_splash_done") === "1";
  });

  const [langChosen, setLangChosen] = useState(() => {
    return localStorage.getItem("contractai_lang") !== null;
  });

  const handleSplashComplete = useCallback(() => {
    sessionStorage.setItem("contractai_splash_done", "1");
    setSplashDone(true);
  }, []);

  const handleLangComplete = useCallback(() => {
    setLangChosen(true);
  }, []);

  return (
    <>
      {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
      {splashDone && !langChosen && <LanguagePopup onComplete={handleLangComplete} />}
      {splashDone && langChosen && (
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
      )}
      <Toaster />
    </>
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
