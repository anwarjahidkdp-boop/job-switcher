// What a job post asks applicants to send, and whether the application pack already covers each item.
// The AI tailoring step reads the full post; this file is the deterministic fallback and the status logic.

export type AskStatus = "ready" | "photo" | "you";
export interface AskRow { item: string; status: AskStatus; note: string }

/** Common items, the words posts use for them, and the label we show. Order is the order shown. */
const KNOWN: { re: RegExp; label: string }[] = [
  { re: /\b(cv|c\.v\.|r[ée]sum[ée]|curriculum vitae|bio-?data)\b/i, label: "CV" },
  { re: /\b(cover(ing)? letter|application letter|motivation letter|letter of motivation)\b/i, label: "Cover letter" },
  { re: /\b(passport[- ]size )?(photo|photograph)s?\b/i, label: "Recent photo" },
  { re: /\b(experience (letter|certificate)s?|release letter|relieving letter|service certificate)\b/i, label: "Experience letters" },
  { re: /\b(academic|educational) (certificates?|documents?|transcripts?)|\bmark ?sheets?\b|\btranscripts?\b|\bcertificates? (of|for) (all )?(academic|education)/i, label: "Academic certificates and transcripts" },
  { re: /\b(professional (certificates?|qualifications?) (copies|documents)|copies of (professional )?certificates?)\b/i, label: "Copies of professional certificates" },
  { re: /\b(nid|national id(entity)?( card)?|national identity card)\b/i, label: "National ID (NID) copy" },
  { re: /\bpassport (copy|details|scan)\b/i, label: "Passport copy" },
  { re: /\b(expected|current and expected|present and expected) salary\b|\bsalary expectations?\b/i, label: "Expected salary" },
  { re: /\bnotice period\b/i, label: "Notice period" },
  { re: /\bportfolio\b|\bwork samples?\b/i, label: "Portfolio or work samples" },
  { re: /\b(two|three|2|3)?\s*(professional )?(references|referees)\b/i, label: "References" },
  { re: /\bselection criteria\b|\bkey selection criteria\b/i, label: "Answers to the selection criteria" },
  { re: /\b(application form)\b/i, label: "Application form" },
  { re: /\b(pay ?slips?|salary certificate)\b/i, label: "Salary certificate or payslip" },
  { re: /\b(right to work|work authori[sz]ation|work permit)\b/i, label: "Right-to-work or work-permit proof" },
];

/** Items a post's text asks for, found by keyword. Used when the AI step did not run. */
export function postAsks(text: string | null | undefined): string[] {
  const t = String(text || "");
  if (!t.trim()) return [];
  // Only the part that talks about applying, when the post has one, so "prepare CVs for clients" in duties does not count.
  const apply = t.match(/(how to apply|to apply|application (process|procedure|instructions)|interested (candidates|applicants)|please (send|submit|apply|email)|applicants? (should|must|are requested)|send (your|their)|submit (your|their))[\s\S]{0,900}/i);
  const scope = apply ? apply[0] : t;
  return KNOWN.filter((k) => k.re.test(scope)).map((k) => k.label);
}

/** One row per asked item: ready in the pack, on the CV as a photo, or for the person to attach. */
export function askRows(asks: string[], opts: { hasPhoto: boolean; photoAllowed: boolean; notice: number | null; salaryMin: number | null }): AskRow[] {
  const seen = new Set<string>();
  const rows: AskRow[] = [];
  for (const raw of asks) {
    const item = String(raw || "").trim().slice(0, 140);
    if (!item || seen.has(item.toLowerCase())) continue;
    seen.add(item.toLowerCase());
    if (KNOWN[0].re.test(item)) rows.push({ item, status: "ready", note: "Tailored CV in this application" });
    else if (KNOWN[1].re.test(item)) rows.push({ item, status: "ready", note: "Cover letter in this application" });
    else if (KNOWN[2].re.test(item)) rows.push(opts.hasPhoto && opts.photoAllowed ? { item, status: "photo", note: "Your photo is on the CV. Attach a separate copy if the post asks for a file." } : { item, status: "you", note: "Add a photo from the CV toolbar, or attach one" });
    else if (/notice period/i.test(item)) rows.push({ item, status: opts.notice ? "ready" : "you", note: opts.notice ? `In your cover letter: ${opts.notice} days` : "Add your notice period in Preferences" });
    else if (/salary/i.test(item) && !/certificate|slip/i.test(item)) rows.push({ item, status: opts.salaryMin ? "ready" : "you", note: opts.salaryMin ? "Stated in your cover letter from your Preferences" : "Add your expected salary in Preferences" });
    else rows.push({ item, status: "you", note: "Attach this yourself" });
  }
  return rows;
}

export interface ApplicationFee { amounts: number[]; methods: string[] }
const FEE_WORD = /(?:আবেদন|পরীক্ষার)\s*ফি|ফি\s*বাবদ|application (?:and examination )?fee|exam(?:ination)? fee|fee of/gi;
const FEE_METHODS: [RegExp, string][] = [
  [/bank draft|demand draft|ব্যাংক ড্রাফট|ব্যাংক ড্রাফ্ট/i, "bank draft"],
  [/pay ?order|পে[- ]?অর্ডার/i, "pay order"],
  [/treasury challan|ট্রেজারি চালান/i, "treasury challan"],
  [/teletalk|টেলিটক|\bsms\b/i, "Teletalk SMS"],
  [/bkash|বিকাশ/i, "bKash"], [/nagad|নগদ/i, "Nagad"], [/rocket|রকেট/i, "Rocket"],
];
/** The fee a Bangladesh government circular charges to apply, read from the text near its fee words: amounts in taka and how to pay.
 *  A circular can charge differently by post or applicant group, so every amount it names is kept. */
export function applicationFee(text: string | null | undefined): ApplicationFee | null {
  const t = String(text || "").replace(/[০-৯]/g, (c) => String("০১২৩৪৫৬৭৮৯".indexOf(c)));
  const amounts = new Set<number>(), methods = new Set<string>();
  for (const m of t.matchAll(FEE_WORD)) {
    const near = t.slice(m.index ?? 0, (m.index ?? 0) + m[0].length + 220).split(/\n(?!\s*[-•])/)[0];
    for (const a of near.matchAll(/(?:(?:tk\.?|taka|৳)\s*(\d[\d,]*(?:\.\d+)?))|(?:(\d[\d,]*(?:\.\d+)?)\s*(হাজার|thousand)?\s*(?:\/-)?\s*(?:টাকা|tk\b|taka))/gi)) {
      const n = Number((a[1] || a[2]).replace(/,/g, "")) * (a[3] ? 1000 : 1);
      if (Number.isFinite(n) && n >= 10 && n <= 10_000) amounts.add(Math.round(n));
    }
    for (const [re, label] of FEE_METHODS) if (re.test(near)) methods.add(label);
  }
  return amounts.size ? { amounts: [...amounts].sort((a, b) => a - b), methods: [...methods] } : null;
}

/** "৳700 by bank draft or treasury challan"; a spread of amounts says it depends on the post. */
export function feeLine(f: ApplicationFee): string {
  const money = (n: number) => `৳${n.toLocaleString("en-IN")}`;
  const amount = f.amounts.length === 1 ? money(f.amounts[0]) : `${money(f.amounts[0])} to ${money(f.amounts[f.amounts.length - 1])}, by post or applicant group`;
  const how = f.methods.length ? ` · pay by ${f.methods.length > 1 ? f.methods.slice(0, -1).join(", ") + " or " + f.methods[f.methods.length - 1] : f.methods[0]}` : "";
  return amount + how;
}
