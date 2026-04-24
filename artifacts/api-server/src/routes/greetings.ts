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

const TONES = [
  "dry legal wit — as if a barrister wrote it between hearings",
  "courtroom swagger — confident, a little theatrical",
  "the pure joy of catching a loophole no one else noticed",
  "detective-level contract scrutiny — sharp, perceptive, satisfied",
  "the quiet satisfaction of clause-by-clause victory",
  "a paralegal who moonlights as a stand-up comedian",
  "contract nerd energy — endearingly obsessive about the details",
  "the calm of someone who has read every fine-print trap in existence",
];

const FALLBACKS = [
  "The fine print has been waiting. Honestly, it's a little nervous.",
  "Another day, another clause that won't get past you.",
  "Consider this your retainer. Let's get to work.",
  "Objection overruled — you're in.",
  "The opposing counsel never saw you coming. Neither did your contracts.",
  "Your contracts missed you. They were getting restless without proper scrutiny.",
  "Back again? Good. These clauses won't cross-examine themselves.",
  "Every signature tells a story. Ready to read yours?",
  "The ink is dry, but the analysis is just getting started.",
  "You signed up to understand what you sign. Smart move. Let's go.",
];

router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const name = (req.query["name"] as string | undefined)?.trim() || "";
    const tone = TONES[Math.floor(Math.random() * TONES.length)];

    const groq = getGroq();
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You write short, witty welcome-back messages for a legal contract analysis app called ContractAI. " +
            "Messages are cheeky but warm, always contract-themed, and make the user smile or quietly chuckle. " +
            "Think legal puns, courtroom wit, or the dry satisfaction of someone who catches every fine-print trap. " +
            "Write exactly 1–2 sentences. No quotation marks. No emojis. No hashtags. No corporate-speak. " +
            "Make it feel personal and a little unexpected — like a message they'd want to screenshot.",
        },
        {
          role: "user",
          content:
            `Write a welcome-back message${name ? ` for ${name}` : ""}. ` +
            `Tone: ${tone}. ` +
            `${name ? `Address them naturally as "${name}" somewhere in the message. ` : ""}` +
            "Do not start with 'Welcome back'. Surprise them with something fresh and clever. " +
            "Keep it contract-related — clauses, fine print, signatures, legal analysis, etc.",
        },
      ],
      max_tokens: 80,
      temperature: 1.15,
    });

    const message = completion.choices[0]?.message?.content?.trim() ?? FALLBACKS[0]!;
    res.json({ message });
  } catch {
    const message = FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)]!;
    res.json({ message });
  }
});

export default router;
