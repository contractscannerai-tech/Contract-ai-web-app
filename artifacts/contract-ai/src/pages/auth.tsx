import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import { login, signup } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { BiometricLoginButton } from "@/components/biometric-login-button";

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const { t } = useI18n();

  const params = new URLSearchParams(search);
  const isSignupFlow = params.get("signup") === "1";

  const termsTimestamp = sessionStorage.getItem("contractai_terms_ts");
  const termsValid = termsTimestamp ? Date.now() - parseInt(termsTimestamp) < 30 * 60 * 1000 : false;

  const [mode, setMode] = useState<"login" | "signup">(
    isSignupFlow && termsValid ? "signup" : "login"
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (isSignupFlow && !termsValid) {
      setLocation("/terms");
    }
  }, [isSignupFlow, termsValid, setLocation]);

  function handleCreateAccount() {
    setLocation("/terms");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    if (mode === "signup" && password.length < 8) {
      toast({ title: "Password too short", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const result = await login(email, password);
        if (result.success) {
          toast({ title: "Welcome back!", description: "Redirecting to your dashboard..." });
          setTimeout(() => setLocation("/dashboard", { replace: true }), 600);
        } else {
          const msg = friendlyAuthError(result.error, "login");
          toast({ title: "Login failed", description: msg, variant: "destructive" });
        }
      } else {
        const result = await signup(email, password, true);
        if (result.success) {
          sessionStorage.removeItem("contractai_terms_ts");
          toast({ title: "Account created!", description: "Welcome to ContractAI. Redirecting to your dashboard..." });
          setTimeout(() => setLocation("/dashboard", { replace: true }), 800);
        } else {
          const msg = friendlyAuthError(result.error, "signup");
          toast({ title: "Registration failed", description: msg, variant: "destructive" });
        }
      }
    } finally {
      setLoading(false);
    }
  }

  function friendlyAuthError(raw: string | undefined, flow: "login" | "signup"): string {
    if (!raw) {
      return flow === "login"
        ? "Login failed. Please check your credentials and try again."
        : "Registration failed. Please try again.";
    }
    const lower = raw.toLowerCase();
    if (lower.includes("invalid login credentials") || lower.includes("invalid credentials") || lower.includes("wrong password")) {
      return "Incorrect password. Please check your password and try again.";
    }
    if (lower.includes("user not found") || lower.includes("no account") || lower.includes("email not found")) {
      return "No account exists with this email address. Please register a new account.";
    }
    if (lower.includes("email already") || lower.includes("already registered") || lower.includes("already exists") || lower.includes("duplicate")) {
      return "An account already exists with this email. Please login instead.";
    }
    if (lower.includes("email not confirmed") || lower.includes("email confirmation")) {
      return "Your email has not been confirmed. Please check your inbox for a confirmation link.";
    }
    if (lower.includes("too many") || lower.includes("rate limit")) {
      return "Too many attempts. Please wait a few minutes before trying again.";
    }
    if (lower.includes("password") && lower.includes("weak")) {
      return "Password is too weak. Please choose a password with at least 8 characters, including numbers and letters.";
    }
    if (lower.includes("terms") || lower.includes("terms of service")) {
      return "You must accept the Terms of Service before creating an account.";
    }
    return raw;
  }

  async function handleGoogleAuth() {
    setGoogleLoading(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "https://contract-ai--Contractaiscan.replit.app/auth/callback",
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
    } catch {
      setGoogleLoading(false);
    }
  }

  if (mode === "login") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <nav className="flex items-center justify-between px-6 h-16 border-b border-border">
          <button onClick={() => setLocation("/")} className="flex items-center gap-2 hover:opacity-80 transition-opacity" data-testid="link-logo">
            <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold tracking-tight">ContractAI</span>
          </button>
        </nav>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold tracking-tight mb-2">{t("auth.login")}</h1>
              <p className="text-sm text-muted-foreground">{t("auth.loginDesc")}</p>
            </div>

            <div className="bg-card border border-card-border rounded-xl shadow-sm p-6 space-y-5">
              <Button
                type="button"
                variant="outline"
                className="w-full flex items-center gap-3 font-medium"
                onClick={handleGoogleAuth}
                disabled={googleLoading || loading}
                data-testid="button-google-auth"
              >
                {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
                {t("auth.continueGoogle")}
              </Button>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex-1 h-px bg-border" />
                <span>{t("auth.orEmail")}</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t("auth.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="pr-10"
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading || googleLoading} data-testid="button-submit-auth">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {t("auth.submit")}
                </Button>
              </form>

              <BiometricLoginButton
                email={email}
                onSuccess={() => setTimeout(() => setLocation("/dashboard", { replace: true }), 500)}
              />
            </div>

            <div className="mt-6 border border-border rounded-xl p-5 text-center bg-card/50">
              <p className="text-sm font-medium mb-1">{t("auth.newTo")}</p>
              <p className="text-xs text-muted-foreground mb-4">{t("auth.createFree")}</p>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleCreateAccount}
                data-testid="button-create-account"
              >
                {t("auth.createAccount")}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground mt-4">
              {t("auth.privacyAcknowledge")}{" "}
              <button onClick={() => setLocation("/privacy")} className="underline hover:text-foreground transition-colors">
                {t("landing.footer.privacy")}
              </button>
              .
            </p>
          </div>
        </div>

        <footer className="py-5 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">{t("common.rights")}</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="flex items-center justify-between px-6 h-16 border-b border-border">
        <button onClick={() => setLocation("/")} className="flex items-center gap-2 hover:opacity-80 transition-opacity" data-testid="link-logo">
          <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span className="font-bold tracking-tight">ContractAI</span>
        </button>
      </nav>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-700 border border-green-500/20 rounded-full px-3 py-1 text-xs font-medium mb-4">
              {t("auth.termsAccepted")}
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">{t("auth.createAccount")}</h1>
            <p className="text-sm text-muted-foreground">{t("auth.chooseMethod")}</p>
          </div>

          <div className="bg-card border border-card-border rounded-xl shadow-sm p-6 space-y-5">
            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center gap-3 font-medium"
              onClick={handleGoogleAuth}
              disabled={googleLoading || loading}
              data-testid="button-google-auth"
            >
              {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
              {t("auth.registerGoogle")}
            </Button>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex-1 h-px bg-border" />
              <span>{t("auth.orCreateEmail")}</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("auth.minPassword")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="pr-10"
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading || googleLoading} data-testid="button-submit-auth">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {t("auth.createBtn")}
              </Button>
            </form>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {t("auth.alreadyHave")}{" "}
            <button
              onClick={() => setLocation("/auth")}
              className="text-primary font-medium hover:underline"
              data-testid="button-switch-mode"
            >
              {t("auth.login")}
            </button>
          </p>
        </div>
      </div>

      <footer className="py-5 border-t border-border text-center">
        <p className="text-xs text-muted-foreground">{t("common.rights")}</p>
      </footer>
    </div>
  );
}
