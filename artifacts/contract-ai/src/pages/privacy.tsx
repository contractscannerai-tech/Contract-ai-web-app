import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Shield, FileText, Database, Globe, Mail, Lock } from "lucide-react";

const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <div className="mb-8">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary flex-shrink-0">
        {icon}
      </div>
      <h2 className="text-base font-bold">{title}</h2>
    </div>
    <div className="pl-11 text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
  </div>
);

const Tag = ({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "no" | "yes" }) => {
  const cls =
    variant === "no"  ? "bg-destructive/10 text-destructive border-destructive/20" :
    variant === "yes" ? "bg-green-500/10 text-green-700 border-green-500/20" :
                        "bg-primary/10 text-primary border-primary/20";
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full border ${cls}`}>
      {children}
    </span>
  );
};

export default function PrivacyPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="mb-6 gap-2">
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Privacy Policy</h1>
            <p className="text-xs text-muted-foreground">Effective: January 1, 2026 · Last updated: April 2026</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-10 leading-relaxed">
          ContractAI is built with privacy as a core principle. We handle sensitive legal documents
          and take our responsibility to protect your data very seriously. This policy explains exactly
          what data we collect, how we use it, and what we never do.
        </p>

        <Section icon={<Database className="w-4 h-4" />} title="Data We Collect">
          <p>We only collect the minimum necessary data to provide the service:</p>
          <ul className="list-none space-y-1.5 mt-2">
            <li className="flex items-center gap-2"><Tag variant="yes">Collected</Tag> Email address</li>
            <li className="flex items-center gap-2"><Tag variant="yes">Collected</Tag> Full name (if provided via Google OAuth)</li>
            <li className="flex items-center gap-2"><Tag variant="yes">Collected</Tag> Password hash (managed securely by Supabase — we never see your raw password)</li>
            <li className="flex items-center gap-2"><Tag variant="yes">Collected</Tag> Google OAuth identity (if you sign in with Google)</li>
            <li className="flex items-center gap-2"><Tag variant="no">Never collected</Tag> Phone number</li>
            <li className="flex items-center gap-2"><Tag variant="no">Never collected</Tag> Physical address</li>
            <li className="flex items-center gap-2"><Tag variant="no">Never collected</Tag> Any data not listed here</li>
          </ul>
        </Section>

        <Section icon={<FileText className="w-4 h-4" />} title="Document Upload & Processing">
          <p>When you upload a contract (PDF or image), the following rules apply without exception:</p>
          <ul className="list-none space-y-1.5 mt-2">
            <li className="flex items-start gap-2"><Tag variant="yes">✓</Tag><span>Files are processed in-memory only — never written to permanent storage.</span></li>
            <li className="flex items-start gap-2"><Tag variant="yes">✓</Tag><span>Extracted text is temporarily stored to pass to the AI for analysis, then permanently deleted within seconds of analysis completion.</span></li>
            <li className="flex items-start gap-2"><Tag variant="yes">✓</Tag><span>Only the structured analysis results (summary, risks, key clauses) are stored — never the raw document text.</span></li>
            <li className="flex items-start gap-2"><Tag variant="no">✗</Tag><span>We do not store uploaded PDF or image files.</span></li>
            <li className="flex items-start gap-2"><Tag variant="no">✗</Tag><span>We do not store raw extracted document text after processing.</span></li>
            <li className="flex items-start gap-2"><Tag variant="no">✗</Tag><span>We do not log any contract content.</span></li>
          </ul>
        </Section>

        <Section icon={<Globe className="w-4 h-4" />} title="Third-Party Data Sharing">
          <p>
            We only share your data with the following trusted processors, strictly for the purpose of providing the service:
          </p>
          <div className="space-y-3 mt-3">
            {[
              { name: "GROQ API", purpose: "AI-powered contract analysis (llama-3.3-70b-versatile)", data: "Extracted contract text (purged after use)" },
              { name: "OCR.space API", purpose: "Image-to-text conversion for photo scans (Pro/Premium)", data: "Uploaded images (sent directly, not stored by us)" },
              { name: "Dodo Payments", purpose: "Payment and subscription processing", data: "Payment information and IP-based country detection for tax" },
              { name: "Supabase", purpose: "Authentication and database storage", data: "Email, password hash, analysis results" },
            ].map((p) => (
              <div key={p.name} className="bg-card border border-card-border rounded-lg p-3">
                <p className="font-semibold text-xs text-foreground mb-0.5">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.purpose}</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">Data shared: {p.data}</p>
              </div>
            ))}
          </div>
          <p className="mt-3"><Tag variant="no">No other data sharing</Tag> We do not sell, trade, or share your data with any other party.</p>
        </Section>

        <Section icon={<Mail className="w-4 h-4" />} title="Email Usage">
          <p>Your email address is used only for:</p>
          <ul className="list-none space-y-1.5 mt-2">
            <li className="flex items-center gap-2"><Tag variant="yes">Allowed</Tag> Authentication (login, signup, password reset)</li>
            <li className="flex items-center gap-2"><Tag variant="yes">Allowed</Tag> Account support when you contact us</li>
            <li className="flex items-center gap-2"><Tag variant="no">Never</Tag> Marketing or promotional emails</li>
            <li className="flex items-center gap-2"><Tag variant="no">Never</Tag> Unsolicited messages of any kind</li>
          </ul>
        </Section>

        <Section icon={<Globe className="w-4 h-4" />} title="Location Data">
          <ul className="list-none space-y-1.5">
            <li className="flex items-start gap-2"><Tag>Limited use</Tag><span>Your IP address may be used by Dodo Payments to determine your country for tax calculation purposes only.</span></li>
            <li className="flex items-start gap-2"><Tag variant="no">Not stored</Tag><span>Location data is never permanently stored by ContractAI.</span></li>
            <li className="flex items-start gap-2"><Tag variant="no">Not tracked</Tag><span>We do not use location for profiling, tracking, or any other purpose.</span></li>
          </ul>
        </Section>

        <Section icon={<Lock className="w-4 h-4" />} title="Security & Data Retention">
          <ul className="list-none space-y-2">
            <li>All data is transmitted over HTTPS (TLS encryption).</li>
            <li>Authentication is handled by Supabase, a SOC 2 Type II certified platform.</li>
            <li>Server logs follow strict format rules and <strong>never contain contract content, personal data, or sensitive text</strong>.</li>
            <li><strong>Uploaded files:</strong> purged immediately after text extraction (memory only — never on disk).</li>
            <li><strong>Extracted text:</strong> permanently deleted from our database within seconds of AI analysis completing.</li>
            <li><strong>Analysis results:</strong> retained until you delete the contract or your account.</li>
            <li><strong>Account data:</strong> retained until you delete your account via Settings → Delete Account.</li>
          </ul>
        </Section>

        <Section icon={<Database className="w-4 h-4" />} title="Your Rights & Data Control">
          <p>You have full control over your data:</p>
          <ul className="list-none space-y-1.5 mt-2">
            <li className="flex items-start gap-2"><Tag variant="yes">✓</Tag><span><strong>Delete individual contracts</strong> — removes the contract and all associated analysis data immediately.</span></li>
            <li className="flex items-start gap-2"><Tag variant="yes">✓</Tag><span><strong>Delete your account</strong> — permanently removes all your data including contracts, analysis history, chat history, and authentication credentials. Available in Settings.</span></li>
            <li className="flex items-start gap-2"><Tag variant="yes">✓</Tag><span><strong>Data portability</strong> — contact us at support to request an export of your stored analysis data.</span></li>
          </ul>
        </Section>

        <div className="bg-muted/50 border border-border rounded-xl p-5 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Contact & Questions</p>
          <p>If you have any questions about this Privacy Policy or our data practices, please contact us at the support email listed in your account settings. We are committed to responding within 48 hours.</p>
          <p className="mt-2">This policy may be updated periodically. We will notify you of material changes via the email on your account.</p>
        </div>
      </div>
    </div>
  );
}
