import { Router } from "express";
import type { Response } from "express";
import Groq from "groq-sdk";
import { requireAuth } from "../middlewares/auth.js";
import type { AuthenticatedRequest } from "../middlewares/auth.js";

const router = Router();

function getGroq() {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");
  return new Groq({ apiKey });
}

const GREETING_PROMPTS = [
  "morning warmth",
  "gentle encouragement",
  "calm confidence",
  "soft delight",
  "friendly energy",
  "quiet motivation",
  "serene optimism",
];

router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const name = (req.query["name"] as string | undefined)?.trim() || "";
    const tone = GREETING_PROMPTS[Math.floor(Math.random() * GREETING_PROMPTS.length)];
    const nameClause = name ? `, ${name}` : "";

    const groq = getGroq();
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are a warm, thoughtful AI that writes brief, heartfelt welcome-back messages for a legal contract analysis app called ContractAI. " +
            "Each message must be unique, soft, and genuinely uplifting — never generic or corporate. " +
            "Write exactly 1–2 sentences. No quotation marks. No emojis. No hashtags. Just the message itself.",
        },
        {
          role: "user",
          content:
            `Write a welcome-back greeting for someone named \"${name || "a user"}\" who has just opened ContractAI. ` +
            `The tone should feel like ${tone}. ` +
            `Address them as \"${nameClause ? name : "you"}\" naturally within the sentence. ` +
            "Make it feel personal, warm, and different from anything you've written before. " +
            "Do not start with 'Welcome back' — surprise them with something fresh.",
        },
      ],
      max_tokens: 80,
      temperature: 1.1,
    });

    const message = completion.choices[0]?.message?.content?.trim() ?? "Great to have you back — let's make today's contracts work for you.";
    res.json({ message });
  } catch (err) {
    const fallbacks = [
      "Every contract tells a story — glad you're here to decode yours.",
      "Your legal clarity journey continues right where you left off.",
      "The smartest legal move you'll make today starts right here.",
      "Back again — your contracts are ready and waiting for you.",
      "Good to see you. Let's turn complex legalese into clear decisions.",
      "Your instinct to understand what you sign is your greatest asset.",
      "Precision, clarity, protection — everything you need is right here.",
    ];
    const message = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    res.json({ message });
  }
});

export default router;
