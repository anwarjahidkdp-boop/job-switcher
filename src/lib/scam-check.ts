// Warning signs of a fake or fraudulent job post, from the post's own text. It never hides or blocks a job:
// the job page shows the reasons so the person can check before paying anything or sharing documents.
// Patterns follow common recruitment-fraud guidance (Action Fraud, JobsAware, Bangladesh police and BMET alerts).
import type { Job } from "./types";

export type ScamLevel = "none" | "caution" | "high";
export interface ScamCheck { level: ScamLevel; reasons: string[] }

interface Sign { re: RegExp; reason: string; weight: 2 | 1 }

// Strong signs: a real employer does not charge applicants or ask for money or bank access to hire them.
const STRONG: Sign[] = [
  { re: /\b(registration|application|processing|training|joining|interview|visa processing|medical|security|uniform|kit)\s+(fee|fees|charge|charges|cost|deposit)\b|\b(fee|deposit|payment)\s+(of|for)\s+(registration|the application|training|processing|joining|the interview|the visa)/i, reason: "Asks applicants to pay a fee or deposit", weight: 2 },
  { re: /(রেজিস্ট্রেশন|নিবন্ধন|প্রশিক্ষণ|জামানত|জামানতের|প্রসেসিং)\s*(ফি|টাকা|বাবদ)|জামানত\s*(হিসেবে|দিতে|জমা)|টাকা\s*জামানত/, reason: "Asks applicants to pay a fee or deposit (জামানত/ফি)", weight: 2 },
  { re: /\b(send|pay|transfer|deposit)\b[^.\n]{0,40}\b(money|amount|fee|tk\.?|taka|bdt|£|\$|usd|gbp)\b|\b(bkash|nagad|rocket)\b[^.\n]{0,30}\b(send|pay|fee|charge)/i, reason: "Asks you to send money", weight: 2 },
  { re: /\b(gift ?cards?|bitcoin|crypto(currency)?|usdt|western union|moneygram)\b/i, reason: "Mentions gift cards, crypto or untraceable money transfers", weight: 2 },
  { re: /\b(bank (account|login|card|pin)|card (number|pin)|online banking|cvv|otp)\b[^.\n]{0,60}\b(send|share|provide|give|required|needed)|\b(send|share|provide|give)\b[^.\n]{0,40}\b(bank (account )?(details|login|pin)|card (number|details)|otp|cvv)\b/i, reason: "Asks for bank, card or OTP details before hiring", weight: 2 },
  { re: /\b(receive|forward|transfer)\b[^.\n]{0,30}\b(payments?|parcels?|packages?)\b[^.\n]{0,30}\b(on behalf|for (the|our) (company|client))|\b(money|payment) (mule|processing agent)\b|\breship(ping)? (packages|parcels)\b/i, reason: "Describes handling money or parcels for the company (a known money-mule pattern)", weight: 2 },
];

// Weaker signs: each alone is common in real posts, so two or more are needed for a caution.
const WEAK: Sign[] = [
  { re: /\b(contact|message|apply|reach)\b[^.\n]{0,25}\b(whats ?app|telegram|signal|imo|viber)\b|\b(whats ?app|telegram)\s*(only|number|us)\b/i, reason: "Asks you to apply or talk only by WhatsApp, Telegram or similar", weight: 1 },
  { re: /\b(earn|make|income of|get paid)\b[^.\n]{0,30}(£|\$|tk\.?|৳|bdt|usd)\s?[\d,]+[^.\n]{0,25}\b(per|a|each|every|daily|weekly)\s?(day|hour|week|daily)\b/i, reason: "Promises quick earnings per day or hour", weight: 1 },
  { re: /\b(no (experience|interview|qualifications?) (needed|required)|guaranteed (job|income|placement|visa)|100% (job|visa|placement)|instant (hire|joining|job))\b/i, reason: "Promises a guaranteed job, visa or income", weight: 1 },
  { re: /\b(like|rate|review|follow)\b[^.\n]{0,20}\b(videos?|posts?|products?|hotels?|apps?)\b[^.\n]{0,30}\b(earn|paid|commission|income)|\b(task[- ]based|online tasks?|data entry from home|copy[- ]paste work)\b/i, reason: "Paid 'tasks' such as liking videos, reviews or copy-paste work", weight: 1 },
  { re: /\b(urgent(ly)?|immediate(ly)?|limited (seats|slots|positions))\b[^.\n]{0,40}\b(pay|deposit|fee|register|confirm (your )?(seat|slot))/i, reason: "Pressures you to pay or register quickly", weight: 1 },
  { re: /\b(passport|nid|national id|birth certificate)\b[^.\n]{0,40}\b(original|hand ?over|deposit|submit (the )?original)/i, reason: "Asks you to hand over original passport or ID", weight: 1 },
];

// Lines that state the opposite ("we never charge a fee") must not count as a warning.
const NEGATION = /\b(never|no|not|doesn['’]?t|does not|won['’]?t|will not|free of|without any)\b[^.\n]{0,40}\b(fee|fees|charge|charges|money|payment|deposit)\b|(কোনো|কোন)\s*(ফি|টাকা)\s*(লাগবে না|নেওয়া হয় না|দিতে হবে না)/i;
const FREE_MAIL = /@(gmail|yahoo|hotmail|outlook|live|aol|ymail|proton(mail)?|icloud|mail)\.(com|co\.uk|net|me)\b/i;

/** Splits into sentences so a "no fee" line clears only itself, not a real fee request elsewhere. */
function sentences(t: string): string[] {
  return t.split(/(?<=[.!?।])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
}

// Bangladesh government circulars charge a set application fee paid through Teletalk; that is the official route.
const OFFICIAL_FEE = /teletalk|alljobs\.teletalk|প্রিপেইড|পরীক্ষার ফি/i;
const FEE_REASONS = new Set([STRONG[0].reason, STRONG[1].reason, STRONG[2].reason]);

export function scamCheck(job: Pick<Job, "company" | "title" | "apply">, text: string | null | undefined, opts: { official?: boolean } = {}): ScamCheck {
  const body = String(text || "").slice(0, 20000);
  const lines = sentences(`${job.title}\n${body}`).filter((l) => !NEGATION.test(l));
  const officialFee = opts.official || OFFICIAL_FEE.test(body);
  const reasons = new Map<string, number>();
  for (const s of [...STRONG, ...WEAK]) if (!(officialFee && FEE_REASONS.has(s.reason)) && lines.some((l) => s.re.test(l))) reasons.set(s.reason, s.weight);
  // A named company asking for applications to a free personal mailbox is a weak sign on its own.
  if (job.apply.method === "email" && FREE_MAIL.test(job.apply.target || "") && job.company && !/confidential|private|individual/i.test(job.company)) {
    reasons.set("A named company asks you to apply to a free personal email address", 1);
  }
  const score = [...reasons.values()].reduce((a, b) => a + b, 0);
  const strong = [...reasons.values()].some((w) => w === 2);
  const level: ScamLevel = strong ? "high" : score >= 2 ? "caution" : "none";
  return { level, reasons: level === "none" ? [] : [...reasons.keys()] };
}
