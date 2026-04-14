import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { FileText } from "lucide-react";

const TERMS_TEXT = `ContractAI provides AI-powered contract analysis for informational and educational purposes only and does not constitute legal advice and is not a law firm and does not establish any attorney-client relationship and does not replace the services of a licensed attorney or legal professional, and users expressly acknowledge that all AI-generated outputs including summaries, risk assessments, key clause identifications, and renegotiation recommendations may be inaccurate, incomplete, outdated, or inapplicable to their specific legal situation, and users are solely responsible for any decisions made or actions taken based on information provided by the platform, and ContractAI expressly disclaims all liability for any loss, damage, legal consequence, or adverse outcome arising from reliance on platform outputs. Users must be at least eighteen (18) years of age to use this service and by creating an account represent that they meet this age requirement. Uploaded documents including PDF files and images are temporarily processed solely for the purpose of AI analysis and optical character recognition and are handled in-memory only and are never permanently stored to disk or retained beyond the processing window, and raw extracted document text is automatically and permanently deleted from our systems within seconds of AI analysis completion, and users acknowledge that document content is transmitted to third-party AI processing services including GROQ API for language model analysis and OCR.space for image-to-text conversion and that these transmissions are necessary for the service to function, and users consent to such transmission and acknowledge that ContractAI has no control over the internal data handling practices of these third-party providers beyond the contractual protections in place. Payment processing is handled exclusively by Dodo Payments and by subscribing to any paid plan users agree to be bound by the terms and conditions and privacy policy of Dodo Payments, and subscription fees are billed in advance on a monthly or annual basis as selected, and all payments are non-refundable except where required by applicable law, and ContractAI reserves the right to modify pricing with reasonable advance notice to users. Authentication and user data storage is managed by Supabase and users acknowledge that their authentication credentials and account data are subject to Supabase's terms of service and privacy policy in addition to these terms. Users agree not to use this platform for any unlawful purpose, not to upload documents that are illegal or that they do not have the right to process, not to attempt to reverse engineer, circumvent, or interfere with any security mechanism of the platform, not to use automated means to access or scrape the platform, and not to misrepresent their identity or affiliation. ContractAI reserves the right to suspend or terminate any account at its discretion for violation of these terms without liability, and upon termination users lose access to all stored analysis results and data associated with their account. Users may delete their account at any time through the Settings page which will result in immediate and permanent deletion of all stored data associated with their account including analysis history, chat history, and authentication credentials, and this deletion is irreversible. ContractAI makes no warranties express or implied regarding the reliability, accuracy, fitness for a particular purpose, or uninterrupted availability of the platform, and the platform is provided on an as-is basis to the maximum extent permitted by applicable law. To the fullest extent permitted by law, ContractAI's total liability to any user for any claim arising from use of the platform shall not exceed the total amount paid by that user in the twelve months preceding the claim, and in no event shall ContractAI be liable for any indirect, incidental, special, consequential, or punitive damages. These terms are governed by and construed in accordance with applicable law and any disputes arising under these terms shall be subject to the exclusive jurisdiction of the courts of competent jurisdiction. ContractAI reserves the right to update these terms at any time and continued use of the platform following notification of changes constitutes acceptance of the revised terms. By checking the box below and clicking "Agree & Continue", you confirm that you have read, understood, and agree to be legally bound by these Terms of Service and the ContractAI Privacy Policy in their entirety.`;

export default function TermsPage() {
  const [, setLocation] = useLocation();
  const [agreed, setAgreed] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) setHasScrolled(true);
  }

  function handleAgree() {
    if (!agreed) return;
    sessionStorage.setItem("contractai_terms_ts", Date.now().toString());
    setLocation("/auth?signup=1");
  }

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ color: "#000", fontFamily: "Georgia, 'Times New Roman', serif" }}>

      {/* Minimal header */}
      <header style={{ borderBottom: "1px solid #e0e0e0", padding: "14px 24px", display: "flex", alignItems: "center", gap: "10px", background: "#fff" }}>
        <button
          onClick={() => setLocation("/auth")}
          style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          data-testid="link-logo"
        >
          <div style={{ width: 28, height: 28, background: "#4f46e5", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FileText style={{ width: 14, height: 14, color: "#fff" }} />
          </div>
          <span style={{ fontFamily: "system-ui, sans-serif", fontWeight: 700, fontSize: 15, color: "#000" }}>ContractAI</span>
        </button>
        <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, color: "#555", marginLeft: 8 }}>
          Terms of Service — Please read before creating your account
        </span>
      </header>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 820, width: "100%", margin: "0 auto", padding: "32px 24px 0" }}>

        <h1 style={{ fontFamily: "system-ui, sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 6, color: "#000" }}>
          ContractAI — Terms of Service
        </h1>
        <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, color: "#666", marginBottom: 20 }}>
          Effective Date: January 1, 2026 &nbsp;·&nbsp; You must read and accept these terms to create an account.
        </p>

        {/* Scrollable legal text */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          data-testid="terms-scroll-container"
          style={{
            flex: 1,
            overflowY: "auto",
            border: "1px solid #ccc",
            padding: "28px 32px",
            background: "#fff",
            borderRadius: 4,
            lineHeight: 1.85,
            fontSize: 14.5,
            color: "#000",
            fontFamily: "Georgia, 'Times New Roman', serif",
            maxHeight: "calc(100vh - 320px)",
            minHeight: 300,
          }}
        >
          <p style={{ margin: 0, textAlign: "justify", textJustify: "inter-word" } as React.CSSProperties}>
            {TERMS_TEXT}
          </p>
        </div>

        {!hasScrolled && (
          <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, color: "#888", textAlign: "center", marginTop: 8 }}>
            Scroll to the bottom of the Terms of Service to enable acceptance.
          </p>
        )}
      </div>

      {/* Acceptance footer */}
      <div style={{ background: "#fff", borderTop: "1px solid #e0e0e0", padding: "20px 24px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <label
            style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", marginBottom: 16, fontFamily: "system-ui, sans-serif", fontSize: 14, color: "#000" }}
            data-testid="label-terms-checkbox"
          >
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={!hasScrolled}
              style={{ marginTop: 2, width: 17, height: 17, cursor: hasScrolled ? "pointer" : "not-allowed", flexShrink: 0, accentColor: "#4f46e5" }}
              data-testid="checkbox-terms"
            />
            <span>
              I have read and fully understand the Terms of Service above and agree to be legally bound by them, including the data handling, AI limitation, and payment provisions described therein.
            </span>
          </label>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={handleAgree}
              disabled={!agreed}
              data-testid="button-agree-continue"
              style={{
                background: agreed ? "#4f46e5" : "#c7c7c7",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "11px 28px",
                fontSize: 14,
                fontWeight: 600,
                cursor: agreed ? "pointer" : "not-allowed",
                fontFamily: "system-ui, sans-serif",
                transition: "background 0.2s",
              }}
            >
              Agree &amp; Continue
            </button>

            <button
              onClick={() => setLocation("/auth")}
              style={{ background: "none", border: "none", color: "#555", fontSize: 13, cursor: "pointer", fontFamily: "system-ui, sans-serif", textDecoration: "underline" }}
              data-testid="button-decline"
            >
              Decline — go back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
