import { useState, useEffect } from "react";
import { Star } from "lucide-react";

const REVIEWS = [
  { name: "Sarah K.", role: "Freelance Designer", text: "I used to just sign contracts hoping for the best. Now I actually understand what I'm agreeing to. Caught a sneaky non-compete clause before it was too late." },
  { name: "Marcus T.", role: "Startup Founder", text: "We reviewed 12 vendor contracts in one afternoon. What would have cost $3,000 in legal fees took us 20 minutes. Incredible time and cost savings." },
  { name: "Priya N.", role: "Real Estate Investor", text: "The risk flagging is remarkable. It highlighted indemnification clauses I would have missed entirely. Worth every penny of the premium plan." },
  { name: "James W.", role: "Small Business Owner", text: "Finally, a tool that makes legal documents accessible. I saved thousands on lawyer fees in the first month alone." },
  { name: "Aisha M.", role: "HR Manager", text: "We use ContractAI for all employment contracts now. The AI catches things our team used to overlook. Absolutely essential." },
  { name: "David L.", role: "Consultant", text: "The renegotiation suggestions are gold. I've successfully negotiated better terms on 3 contracts using the premium insights." },
  { name: "Elena R.", role: "Property Manager", text: "Managing 50+ lease agreements is so much easier now. The risk speedometer gives me instant clarity on which contracts need attention." },
  { name: "Tom H.", role: "Freelance Writer", text: "No more signing publishing contracts I don't understand. ContractAI translates legal jargon into plain language instantly." },
];

export function ReviewBubbles() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentIdx((prev) => (prev + 1) % REVIEWS.length);
        setIsVisible(true);
      }, 400);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const review = REVIEWS[currentIdx];

  return (
    <div className="fixed bottom-6 right-6 z-40 max-w-xs hidden md:block">
      <div
        className="bg-card border border-card-border rounded-2xl p-5 shadow-lg transition-all duration-400"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0) scale(1)" : "translateY(8px) scale(0.97)",
          transition: "opacity 0.4s ease, transform 0.4s ease",
        }}
      >
        <div className="flex gap-0.5 mb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="w-3.5 h-3.5 fill-primary text-primary" />
          ))}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">"{review.text}"</p>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center text-xs font-bold text-primary">
            {review.name[0]}
          </div>
          <div>
            <p className="text-xs font-semibold">{review.name}</p>
            <p className="text-[10px] text-muted-foreground">{review.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
