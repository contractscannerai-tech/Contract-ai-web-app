import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, ChevronLeft, AlertCircle, ExternalLink, Lock, CheckCircle } from "lucide-react";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/layout";
import { UpgradeModal } from "@/components/upgrade-modal";

interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  premium: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  Legal: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  HR: "bg-green-500/10 text-green-700 border-green-500/20",
  Business: "bg-purple-500/10 text-purple-700 border-purple-500/20",
  "Real Estate": "bg-amber-500/10 text-amber-700 border-amber-500/20",
  Technology: "bg-cyan-500/10 text-cyan-700 border-cyan-500/20",
};

export default function TemplatesPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user } = useGetMe();
  const logout = useLogout();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  const userIsPremium = user?.plan === "premium" || user?.plan === "team";

  async function handleLogout() {
    await logout.mutateAsync({});
    queryClient.clear();
    setLocation("/", { replace: true });
  }

  useEffect(() => {
    fetch("/api/ai/templates", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { templates?: Template[]; isPremium?: boolean }) => {
        setTemplates(data.templates ?? []);
        setIsPremium(data.isPremium ?? false);
      })
      .catch(() => setError("Failed to load templates."))
      .finally(() => setLoading(false));
  }, []);

  function handleUseTemplate(template: Template) {
    if (template.premium && !userIsPremium) {
      setShowUpgrade(true);
      return;
    }
    setSelectedTemplate(template);
  }

  const categories = [...new Set(templates.map((t) => t.category))];

  return (
    <AppLayout user={user} onLogout={handleLogout}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => setLocation("/dashboard")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Document Templates Library</h1>
            <p className="text-sm text-muted-foreground">Professional document templates ready to draft with AI</p>
          </div>
        </div>

        {!userIsPremium && (
          <div className="mb-6 flex items-start gap-3 bg-amber-500/8 border border-amber-500/20 rounded-xl p-4">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-700">Some templates require Premium</p>
              <p className="text-xs text-muted-foreground mt-0.5">Free templates are available for all users. Upgrade to Legal Partner for the full library and AI drafting.</p>
            </div>
            <Button size="sm" onClick={() => setShowUpgrade(true)}>Upgrade</Button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        ) : (
          <div className="space-y-8">
            {categories.map((category) => (
              <div key={category}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{category}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {templates.filter((t) => t.category === category).map((template) => {
                    const isLocked = template.premium && !userIsPremium;
                    return (
                      <div
                        key={template.id}
                        className={`bg-card border border-card-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 ${isLocked ? "opacity-80" : ""}`}
                        data-testid={`template-${template.id}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl">{template.icon}</span>
                            <div>
                              <h3 className="font-semibold text-sm">{template.name}</h3>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[template.category] ?? "bg-muted text-muted-foreground border-muted"}`}>
                                {template.category}
                              </span>
                            </div>
                          </div>
                          {template.premium ? (
                            isLocked
                              ? <Lock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                              : <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{template.description}</p>
                        <Button
                          size="sm"
                          variant={isLocked ? "outline" : "default"}
                          className="w-full gap-1.5"
                          onClick={() => handleUseTemplate(template)}
                        >
                          {isLocked ? <><Lock className="w-3.5 h-3.5" /> Unlock with Premium</> : <><ExternalLink className="w-3.5 h-3.5" /> Draft with AI</>}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedTemplate(null)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
              className="relative z-10 w-full max-w-md bg-card border border-card-border rounded-2xl shadow-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-5">
                <span className="text-4xl">{selectedTemplate.icon}</span>
                <h2 className="text-lg font-bold mt-3">{selectedTemplate.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">{selectedTemplate.description}</p>
              </div>
              <p className="text-sm text-center text-muted-foreground mb-5">
                Use the <strong>Document Drafting</strong> tool to create this document with AI. Select "{selectedTemplate.name}" as the document type.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedTemplate(null)}>Cancel</Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    setSelectedTemplate(null);
                    setLocation("/ai/draft");
                  }}
                >
                  Go to Document Drafting
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature="Document Templates Library"
        requiredPlan="premium"
      />
    </AppLayout>
  );
}
