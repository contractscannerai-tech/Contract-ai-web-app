import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, FileText, AlertTriangle, CreditCard, Shield,
  Globe, Scale, Trash2, UserCheck, RefreshCw,
} from "lucide-react";

const Section = ({
  icon, title, children,
}: {
  icon: React.ReactNode; title: string; children: React.ReactNode;
}) => (
  <div className="mb-8">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary flex-shrink-0">
        {icon}
      </div>
      <h2 className="text-base font-bold">{title}</h2>
    </div>
    <div className="pl-11 text-sm text-muted-foreground leading-relaxed space-y-2">
      {children}
    </div>
  </div>
);

export default function TermsPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="mb-6 gap-2">
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Terms of Service</h1>
            <p className="text-xs text-muted-foreground">Effective: January 1, 2026 · Last updated: April 2026</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-10 leading-relaxed">
          By accessing or using ContractAI, you agree to be bound by these Terms of Service.
          Please read them carefully before creating an account or uploading any documents.
        </p>

        <Section icon={<AlertTriangle className="w-4 h-4" />} title="No Legal Advice — Important Disclaimer">
          <p>
            ContractAI provides AI-powered contract analysis for <strong className="text-foreground">informational and educational purposes only</strong>.
            It does not constitute legal advice and is not a law firm. Use of ContractAI does not establish any attorney-client relationship
            and does not replace the services of a licensed attorney or legal professional.
          </p>
          <p>
            All AI-generated outputs — including summaries, risk assessments, key clause identifications, and renegotiation recommendations —
            may be inaccurate, incomplete, outdated, or inapplicable to your specific legal situation.
            You are solely responsible for any decisions made or actions taken based on information provided by the platform.
          </p>
          <p>
            ContractAI expressly disclaims all liability for any loss, damage, legal consequence, or adverse outcome
            arising from reliance on platform outputs.
          </p>
        </Section>

        <Section icon={<UserCheck className="w-4 h-4" />} title="Eligibility & Account">
          <p>
            You must be at least <strong className="text-foreground">18 years of age</strong> to use ContractAI.
            By creating an account you represent that you meet this requirement.
          </p>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials and for all activity
            that occurs under your account. You agree to notify us immediately of any unauthorised use of your account.
          </p>
          <p>
            We reserve the right to suspend or terminate accounts that violate these terms, engage in fraudulent activity,
            or attempt to abuse or reverse-engineer any part of the platform.
          </p>
        </Section>

        <Section icon={<Shield className="w-4 h-4" />} title="Document Processing & Data Handling">
          <p>When you upload a contract (PDF or image), the following rules apply without exception:</p>
          <ul className="list-disc list-inside space-y-1.5 mt-2">
            <li>Files are processed <strong className="text-foreground">in-memory only</strong> — never written to permanent storage.</li>
            <li>Extracted text is temporarily stored to pass to the AI for analysis, then <strong className="text-foreground">permanently deleted within seconds</strong> of analysis completion.</li>
            <li>Only structured analysis results (summary, risks, key clauses) are retained — never the raw document text or original file.</li>
            <li>Document content is transmitted to third-party AI processing services (GROQ API, OCR.space) as necessary for the service to function. By uploading a document you consent to such transmission.</li>
          </ul>
          <p>
            You must only upload documents for which you have the legal right to share or analyse. You must not upload documents
            containing classified information, information subject to confidentiality obligations you cannot waive, or any content
            that is unlawful to share.
          </p>
        </Section>

        <Section icon={<Globe className="w-4 h-4" />} title="Third-Party Services">
          <p>ContractAI integrates with the following third-party services to deliver the platform:</p>
          <div className="space-y-2 mt-3">
            {[
              { name: "GROQ API", desc: "Large language model analysis (llama-3.3-70b-versatile). Contract text is sent for processing and is not retained by ContractAI after analysis." },
              { name: "OCR.space", desc: "Image-to-text conversion for photo uploads (Pro / Legal Partner plans). Uploaded images are sent directly to OCR.space and are not stored by ContractAI." },
              { name: "Dodo Payments", desc: "Payment and subscription processing. By subscribing you agree to Dodo Payments' terms and privacy policy." },
              { name: "Supabase", desc: "Authentication and structured data storage. Your email, password hash, and analysis results are stored on Supabase infrastructure." },
            ].map((s) => (
              <div key={s.name} className="bg-card border border-card-border rounded-lg p-3">
                <p className="font-semibold text-xs text-foreground mb-0.5">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-2">
            ContractAI has no control over the internal data handling practices of these third-party providers
            beyond the contractual protections in place with each.
          </p>
        </Section>

        <Section icon={<CreditCard className="w-4 h-4" />} title="Payments & Subscriptions">
          <p>
            Paid plans (Pro, Legal Partner) are billed on a recurring monthly or annual basis via Dodo Payments.
            By subscribing you authorise us to charge your payment method on a recurring basis until you cancel.
          </p>
          <ul className="list-disc list-inside space-y-1.5 mt-2">
            <li>Subscriptions renew automatically unless cancelled before the renewal date.</li>
            <li>Contract scans used within a billing period are non-refundable.</li>
            <li>You may cancel your subscription at any time from your Settings page; access continues until the end of the current billing period.</li>
            <li>We reserve the right to change pricing with reasonable notice. Price changes take effect at your next renewal.</li>
            <li>Refunds are issued at our discretion for technical failures that prevent use of the service.</li>
          </ul>
        </Section>

        <Section icon={<FileText className="w-4 h-4" />} title="Intellectual Property">
          <p>
            All platform code, design, AI prompts, branding, and non-user-generated content are owned by or licensed to ContractAI.
            You may not reproduce, distribute, modify, or create derivative works from any part of the platform without prior written permission.
          </p>
          <p>
            You retain ownership of any documents you upload. By uploading a document you grant ContractAI a limited, non-exclusive,
            royalty-free licence to process that document solely for the purpose of delivering the analysis results to you.
            This licence terminates when the document and its analysis are deleted.
          </p>
        </Section>

        <Section icon={<Trash2 className="w-4 h-4" />} title="Account Termination & Data Deletion">
          <p>
            You may delete your account at any time from <strong className="text-foreground">Settings → Danger Zone → Delete Account</strong>.
            Deletion permanently removes all your data including contracts, analysis history, chat history, and authentication credentials.
            This action is irreversible.
          </p>
          <p>
            We reserve the right to terminate accounts that violate these terms, with or without notice.
            Upon termination, your access to the platform ceases immediately.
          </p>
        </Section>

        <Section icon={<Scale className="w-4 h-4" />} title="Limitation of Liability">
          <p>
            To the fullest extent permitted by applicable law, ContractAI and its operators shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages, including loss of profits, data, goodwill, or legal consequences,
            arising from or in connection with your use of the platform.
          </p>
          <p>
            Our total aggregate liability to you for any claim arising out of or relating to these terms or the platform shall not exceed
            the greater of (a) the amount you paid to ContractAI in the twelve months preceding the claim, or (b) USD $50.
          </p>
        </Section>

        <Section icon={<RefreshCw className="w-4 h-4" />} title="Changes to These Terms">
          <p>
            We may update these Terms of Service from time to time. Material changes will be communicated via the email on your account
            or via a notice in the platform at least 14 days before taking effect.
          </p>
          <p>
            Continued use of ContractAI after the effective date of any update constitutes acceptance of the revised terms.
            If you do not agree to the updated terms, you must stop using the platform and may delete your account.
          </p>
        </Section>

        <Section icon={<Globe className="w-4 h-4" />} title="Governing Law">
          <p>
            These Terms are governed by and construed in accordance with applicable law.
            Any disputes arising out of or relating to these Terms or the platform shall be subject to the exclusive jurisdiction
            of the courts of competent jurisdiction.
          </p>
        </Section>

        <div className="bg-muted/50 border border-border rounded-xl p-5 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Contact & Questions</p>
          <p>
            If you have any questions about these Terms of Service, please contact us at the support email listed in your account settings.
            We are committed to responding within 48 hours.
          </p>
          <p className="mt-2">
            These Terms were last updated in April 2026. Previous versions are available on request.
          </p>
        </div>
      </div>
    </div>
  );
}
