import { Router } from "express";
import type { Response } from "express";
import Groq from "groq-sdk";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

function getGroq() {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");
  return new Groq({ apiKey });
}

function planError(res: Response) {
  res.status(403).json({
    error: true,
    message: "This feature is available on the Premium plan. Upgrade to continue.",
    details: "User plan does not meet requirement: premium",
    source: "PLAN",
  });
}

function aiError(res: Response, err: unknown) {
  const details = err instanceof Error ? err.message : String(err);
  res.status(500).json({
    error: true,
    message: "AI processing failed. Please try again.",
    details,
    source: "AI",
  });
}

export const TEMPLATES = [
  {
    id: "nda",
    name: "Non-Disclosure Agreement",
    category: "Legal",
    description: "Protect confidential information shared between parties.",
    icon: "🔒",
    premium: false,
  },
  {
    id: "employment",
    name: "Employment Contract",
    category: "HR",
    description: "Standard employment agreement covering salary, duties, and termination.",
    icon: "🤝",
    premium: true,
  },
  {
    id: "freelance",
    name: "Freelance Service Agreement",
    category: "Business",
    description: "Scope of work, payment terms, and IP ownership for contractors.",
    icon: "💼",
    premium: false,
  },
  {
    id: "rental",
    name: "Property Rental Agreement",
    category: "Real Estate",
    description: "Residential or commercial lease with rights and obligations.",
    icon: "🏠",
    premium: true,
  },
  {
    id: "partnership",
    name: "Business Partnership Agreement",
    category: "Business",
    description: "Define roles, responsibilities, and profit sharing between partners.",
    icon: "🏢",
    premium: true,
  },
  {
    id: "consulting",
    name: "Consulting Agreement",
    category: "Business",
    description: "Professional consulting services, deliverables, and payment schedule.",
    icon: "📋",
    premium: false,
  },
  {
    id: "software",
    name: "Software Development Contract",
    category: "Technology",
    description: "Custom software project scope, milestones, IP, and acceptance criteria.",
    icon: "💻",
    premium: true,
  },
  {
    id: "terms",
    name: "Terms of Service",
    category: "Legal",
    description: "Website or app terms governing user access and liability.",
    icon: "📝",
    premium: true,
  },
];

router.get("/templates", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const isPremium = req.userPlan === "premium";
    res.json({ templates: TEMPLATES, isPremium });
  } catch (err) {
    aiError(res, err);
  }
});

router.post("/draft-document", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (req.userPlan !== "premium") { planError(res); return; }

  const { documentType, title, parties, keyTerms, jurisdiction } = req.body as {
    documentType?: string;
    title?: string;
    parties?: string;
    keyTerms?: string;
    jurisdiction?: string;
  };

  if (!documentType?.trim() || !parties?.trim()) {
    res.status(400).json({
      error: true,
      message: "Document type and parties are required.",
      source: "SYSTEM",
    });
    return;
  }

  try {
    const groq = getGroq();
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: `You are an expert legal document drafter. Create a complete, professional ${documentType} document.

Document details:
- Title: ${title || documentType}
- Parties: ${parties}
- Key terms or clauses requested: ${keyTerms || "Standard terms"}
- Jurisdiction: ${jurisdiction || "General / Not specified"}

Produce a thorough legal document with:
1. A header showing parties, effective date placeholder, and document title
2. Background / Recitals section
3. 6–8 numbered clauses covering: Definitions, Obligations of each party, Payment terms (where applicable), Confidentiality (if applicable), Term and Termination, Limitation of Liability, Governing Law and Jurisdiction, Dispute Resolution
4. Signature block for all parties

Use professional legal language. Format with clear numbered section headings. Be complete — do not use placeholders like "[insert here]" for substantive content.`,
        },
      ],
      temperature: 0.2,
      max_tokens: 3000,
    });

    const document = completion.choices[0]?.message?.content ?? "";
    res.json({ success: true, document, documentType, title: title || documentType });
  } catch (err) {
    aiError(res, err);
  }
});

router.post("/application", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (req.userPlan !== "premium") { planError(res); return; }

  const { role, company, skills, experience, motivation } = req.body as {
    role?: string;
    company?: string;
    skills?: string;
    experience?: string;
    motivation?: string;
  };

  if (!role?.trim()) {
    res.status(400).json({
      error: true,
      message: "Job role is required.",
      source: "SYSTEM",
    });
    return;
  }

  try {
    const groq = getGroq();
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: `Write a compelling professional job application cover letter for the role of ${role}${company ? ` at ${company}` : ""}.

Applicant information:
- Key skills: ${skills || "Not specified — infer from role context"}
- Work experience: ${experience || "Not specified"}
- Motivation / why this role: ${motivation || "Passionate about contributing to the team and growing in this field"}

Write a 3–4 paragraph cover letter that:
1. Opens with a strong, specific hook mentioning the exact role${company ? ` and company` : ""}
2. Showcases the 2–3 most relevant skills and concrete achievements from their experience
3. Explains their genuine motivation and what they bring uniquely to this role
4. Closes confidently with a call to interview

Tone: professional, confident, genuine — never generic. No clichés like "I am writing to express my interest." Make it memorable.`,
        },
      ],
      temperature: 0.55,
      max_tokens: 1200,
    });

    const application = completion.choices[0]?.message?.content ?? "";
    res.json({ success: true, application, role, company });
  } catch (err) {
    aiError(res, err);
  }
});

router.post("/resume", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (req.userPlan !== "premium") { planError(res); return; }

  const { name, email, phone, summary, experience, education, skills, targetRole } = req.body as {
    name?: string;
    email?: string;
    phone?: string;
    summary?: string;
    experience?: string;
    education?: string;
    skills?: string;
    targetRole?: string;
  };

  if (!name?.trim()) {
    res.status(400).json({
      error: true,
      message: "Your full name is required.",
      source: "SYSTEM",
    });
    return;
  }

  try {
    const groq = getGroq();
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: `Create a professional, ATS-optimized resume for ${name}.

Profile details:
- Target Role: ${targetRole || "General professional role"}
- Email: ${email || ""}${phone ? ` | Phone: ${phone}` : ""}
- Professional Summary input: ${summary || "Generate an impactful summary based on the details below"}
- Work Experience: ${experience || "Not provided — create a realistic template structure"}
- Education: ${education || "Not provided"}
- Technical & Professional Skills: ${skills || "Not provided"}

Generate a complete resume with these sections:

# ${name}
${email || "[email]"}${phone ? ` | ${phone}` : ""}${targetRole ? ` | ${targetRole}` : ""}

## Professional Summary
[3–4 sentences, impact-focused, tailored to target role]

## Work Experience
[Each role: Company | Title | Dates — followed by 3–4 bullet points starting with action verbs, quantifying achievements where possible]

## Education
[Degree, Institution, Year]

## Skills
[Organized by category: Technical, Soft Skills, Tools, etc.]

Use action verbs (Led, Built, Increased, Reduced, Managed). Quantify achievements. Optimize for ATS keyword matching for the target role.`,
        },
      ],
      temperature: 0.25,
      max_tokens: 2500,
    });

    const resume = completion.choices[0]?.message?.content ?? "";
    res.json({ success: true, resume, name, targetRole });
  } catch (err) {
    aiError(res, err);
  }
});

router.post("/career", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (req.userPlan !== "premium") { planError(res); return; }

  const { currentRole, interests, education, yearsExp, goals } = req.body as {
    currentRole?: string;
    interests?: string;
    education?: string;
    yearsExp?: string;
    goals?: string;
  };

  if (!interests?.trim()) {
    res.status(400).json({
      error: true,
      message: "Please describe your interests and strengths.",
      source: "SYSTEM",
    });
    return;
  }

  try {
    const groq = getGroq();
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: `You are a professional career coach with deep knowledge of industry trends and job markets. Provide comprehensive, personalized career guidance.

Person's profile:
- Current Role / Starting Point: ${currentRole || "Not yet employed / exploring options"}
- Interests & Strengths: ${interests}
- Education Background: ${education || "Not specified"}
- Years of Experience: ${yearsExp || "Not specified"}
- Career Goals: ${goals || "Seeking direction and growth opportunities"}

Provide structured career guidance in these sections:

## Career Path Recommendations
List 3–4 specific, realistic career paths that match their profile. For each: role title, why it fits them, typical trajectory, and realistic salary range.

## High-Value Skills to Develop
5–6 specific skills (technical and soft) most valuable for their direction. For each: skill name, why it matters now, how to acquire it (course, practice, certification).

## Industry Insights
Current trends in relevant fields, which sectors are growing, which are declining, and where opportunities are concentrating in the next 3–5 years.

## 90-Day Action Plan
Concrete, week-by-week actions they can start immediately: learning, networking, portfolio building, applications.

## 5-Year Outlook
Realistic trajectory, senior roles they could reach, income potential, and emerging opportunities to position for.

Be specific, practical, honest, and encouraging. Base advice on real market conditions.`,
        },
      ],
      temperature: 0.5,
      max_tokens: 2500,
    });

    const guidance = completion.choices[0]?.message?.content ?? "";
    res.json({ success: true, guidance, interests, currentRole });
  } catch (err) {
    aiError(res, err);
  }
});

export default router;
