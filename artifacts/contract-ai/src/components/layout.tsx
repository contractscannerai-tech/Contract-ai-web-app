import { useLocation } from "wouter";
import { FileText, LayoutDashboard, FolderOpen, Settings, Upload, CreditCard, LogOut, Menu, X, History, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { SupportWidget } from "@/components/support-widget";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/lib/i18n";

const PRIVACY_URL = "https://contractscannerai-tech.github.io/Contractai-privacy-policy/";

interface AppLayoutProps {
  children: React.ReactNode;
  user?: { email: string; plan: string; contractsUsed: number; contractsLimit: number } | null;
  onLogout?: () => void;
}

const HOMEPAGE_PATH = "/";

const planColors: Record<string, string> = {
  free: "text-muted-foreground",
  pro: "text-primary",
  premium: "text-accent",
};

export default function AppLayout({ children, user, onLogout }: AppLayoutProps) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useI18n();

  const navItems = [
    { label: t("nav.dashboard"), href: "/dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { label: t("nav.contracts"), href: "/contracts", icon: <FolderOpen className="w-4 h-4" /> },
    { label: t("nav.upload"), href: "/contracts/upload", icon: <Upload className="w-4 h-4" /> },
    { label: "History", href: "/history", icon: <History className="w-4 h-4" /> },
    { label: "Leaderboard", href: "/leaderboard", icon: <Trophy className="w-4 h-4" /> },
    ...(user?.plan === "team" ? [{ label: "Team", href: "/team", icon: <Users className="w-4 h-4" /> }] : []),
    { label: t("nav.pricing"), href: "/pricing", icon: <CreditCard className="w-4 h-4" /> },
    { label: t("nav.settings"), href: "/settings", icon: <Settings className="w-4 h-4" /> },
  ];

  const NavContent = () => (
    <>
      <div className="flex items-center justify-between px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <button onClick={() => setLocation(HOMEPAGE_PATH)} className="font-bold tracking-tight text-sidebar-foreground" data-testid="link-home">ContractAI</button>
        </div>
        <div className="flex items-center gap-1">
          <LanguageSwitcher className="text-sidebar-foreground" />
          <ThemeToggle className="text-sidebar-foreground hover:bg-sidebar-accent" />
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
          return (
            <button
              key={item.href}
              onClick={() => { setLocation(item.href); setMobileOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>

      {user && (
        <div className="px-3 py-4 border-t border-sidebar-border">
          <div className="px-3 py-2 mb-2">
            <p className="text-xs text-sidebar-foreground/60 truncate">{user.email}</p>
            <p className={`text-xs font-medium mt-0.5 ${planColors[user.plan] ?? "text-sidebar-foreground"}`}>
              {user.plan.charAt(0).toUpperCase() + user.plan.slice(1)} plan
            </p>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors text-left"
              data-testid="nav-logout"
            >
              <LogOut className="w-4 h-4" />
              {t("nav.logout")}
            </button>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex flex-col w-56 bg-sidebar border-r border-sidebar-border flex-shrink-0">
        <NavContent />
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-14 px-4 bg-sidebar border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center">
            <FileText className="w-3 h-3 text-primary-foreground" />
          </div>
          <span className="font-bold text-sm text-sidebar-foreground">ContractAI</span>
        </div>
        <div className="flex items-center gap-1">
          <LanguageSwitcher className="text-sidebar-foreground" />
          <ThemeToggle className="text-sidebar-foreground" />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-sidebar-foreground p-1"
            data-testid="button-mobile-menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-56 bg-sidebar flex flex-col">
            <NavContent />
          </div>
        </div>
      )}

      <main className="flex-1 overflow-auto md:pt-0 pt-14">
        {children}
        <footer className="px-6 py-4 border-t border-border mt-8">
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span>{t("common.rights")}</span>
            <span>&middot;</span>
            <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors underline underline-offset-2">
              {t("landing.footer.privacy")}
            </a>
          </div>
        </footer>
      </main>

      <SupportWidget />
    </div>
  );
}
