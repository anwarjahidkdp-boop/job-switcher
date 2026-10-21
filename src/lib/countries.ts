// Target-country rules. Eleven countries have hand-written rules (COUNTRIES); every other country in the world
// (world.ts) gets its region's rules with its own name, currency and time zone. Rows for every country are seeded
// into the `country_rules` table so foreign keys accept any code; this file is the typed source used by code.
import { WORLD, WORLD_BY_CODE, type Region } from "./world";

export type CvTemplate = "modern" | "executive" | "classic";

export interface CountryRule {
  name: string;
  short?: string;
  sym: string;
  per: "month" | "year";
  loc?: string;
  photo: boolean;
  personal: boolean;
  visaField?: boolean;
  doc: "CV" | "Résumé";
  pages: string;
  tpl: CvTemplate;
  onePage?: boolean;
  rules: string[];
  prompt: string;
  checklist: string[];
  timeZone: string;
}

export const COUNTRIES = {
  BD: { name: "Bangladesh", sym: "৳", per: "month", loc: "en-IN", photo: true, personal: true, doc: "CV", pages: "1–2 pages", tpl: "modern", timeZone: "Asia/Dhaka",
    rules: ["A professional photo is expected", "A short personal-details section is common", "1–2 pages for experienced professionals"],
    prompt: "Bangladesh: English CV, 1-2 pages; a professional photo and a short personal-details section are normal. Salaries in BDT per month.",
    checklist: ["Tailored CV (attached in this pack)", "Cover letter", "Recent passport-size photo", "Copies of academic certificates", "NID copy", "Expected salary statement"] },
  AE: { name: "United Arab Emirates", short: "UAE", sym: "AED ", per: "month", photo: true, personal: true, visaField: true, doc: "CV", pages: "2 pages", tpl: "modern", timeZone: "Asia/Dubai",
    rules: ["Photo, nationality and visa status are commonly expected", "Notice period and availability are stated up front", "Salaries are quoted in AED per month"],
    prompt: "United Arab Emirates: 2-page CV; a professional photo and nationality/visa status are commonly included; state notice period and availability to relocate. Salaries in AED per month.",
    checklist: ["Tailored CV with photo", "Cover letter", "Passport copy", "Degree certificate (attestation is needed later for the work visa)", "Experience letters from employers", "Notice period and earliest joining date"] },
  SA: { name: "Saudi Arabia", sym: "SAR ", per: "month", photo: true, personal: true, visaField: true, doc: "CV", pages: "2 pages", tpl: "modern", timeZone: "Asia/Riyadh",
    rules: ["Photo and nationality are commonly expected", "Mention professional accreditation where your field needs it", "Salaries are quoted in SAR per month"],
    prompt: "Saudi Arabia: 2-page CV; a professional photo and nationality are commonly included; the employer sponsors the work visa (iqama). Salaries in SAR per month.",
    checklist: ["Tailored CV with photo", "Cover letter", "Passport copy", "Attested degree certificate (needed for the work visa)", "Experience letters from employers", "Professional accreditation if the role needs it"] },
  MY: { name: "Malaysia", sym: "RM ", per: "month", photo: true, personal: true, visaField: true, doc: "CV", pages: "2 pages", tpl: "executive", timeZone: "Asia/Kuala_Lumpur",
    rules: ["A photo is common but optional", "Expected salary in RM is often asked", "The employer applies for your Employment Pass"],
    prompt: "Malaysia: 2-page CV; a photo is common but optional; state expected salary in RM per month; the employer applies for the Employment Pass.",
    checklist: ["Tailored CV", "Cover letter", "Passport copy", "Degree certificates and transcripts", "Expected salary in RM", "Employment Pass eligibility (the employer applies)"] },
  GB: { name: "United Kingdom", short: "UK", sym: "£", per: "year", photo: false, personal: false, doc: "CV", pages: "2 pages", tpl: "classic", timeZone: "Europe/London",
    rules: ["No photo, date of birth or marital status: UK employers avoid them to prevent bias", "Two pages, reverse-chronological, British spelling", "Say whether you need Skilled Worker visa sponsorship"],
    prompt: "United Kingdom: 2-page CV, no photo, no date of birth, no marital status, British spelling, reverse-chronological. Salaries in GBP per year.",
    checklist: ["Tailored CV (no photo)", "Cover letter", "Right-to-work or visa sponsorship statement", "Two referees (usually asked after interview)", "Evidence of qualifications (e.g. ACCA transcript)"] },
  CA: { name: "Canada", sym: "C$", per: "year", photo: false, personal: false, doc: "Résumé", pages: "2 pages", tpl: "executive", timeZone: "America/Toronto",
    rules: ["No photo, age or marital status", "Two pages, achievement-focused", "Mention your work permit or PR status"],
    prompt: "Canada: 2-page résumé, no photo or personal details, achievement-focused bullets. Salaries in CAD per year.",
    checklist: ["Résumé (no photo)", "Cover letter", "Work permit or PR status", "Educational Credential Assessment (ECA) if you have one", "List of references"] },
  AU: { name: "Australia", sym: "A$", per: "year", photo: false, personal: false, doc: "Résumé", pages: "2–3 pages", tpl: "executive", timeZone: "Australia/Sydney",
    rules: ["No photo or date of birth", "2–3 pages with a key skills section near the top", "Mention visa status and referees"],
    prompt: "Australia: 2-3 page résumé, no photo or date of birth, a key skills section near the top. Salaries in AUD per year.",
    checklist: ["Résumé (no photo)", "Cover letter", "Answers to selection criteria if the ad lists them", "Visa or sponsorship status", "Two referees"] },
  US: { name: "United States", short: "USA", sym: "$", per: "year", photo: false, personal: false, doc: "Résumé", pages: "1 page", tpl: "classic", onePage: true, timeZone: "America/New_York",
    rules: ["No photo, age, marital status or nationality", "One page for most roles", "Achievements first, American spelling"],
    prompt: "United States: 1-page résumé, no photo, age, marital status or nationality; achievement-first bullets; American spelling. Salaries in USD per year.",
    checklist: ["One-page résumé", "Cover letter", "Work authorization or sponsorship status", "Credential evaluation of a foreign degree (e.g. WES) if asked", "LinkedIn profile link"] },
  NZ: { name: "New Zealand", sym: "NZ$", per: "year", photo: false, personal: false, visaField: true, doc: "CV", pages: "2–3 pages", tpl: "executive", timeZone: "Pacific/Auckland",
    rules: ["No photo or date of birth", "2–3 pages with a short profile and key skills at the top", "State your visa status (e.g. Accredited Employer Work Visa) and give two referees"],
    prompt: "New Zealand: 2-3 page CV, no photo or date of birth, short profile and key skills at the top, NZ/British spelling. Salaries in NZD per year.",
    checklist: ["Tailored CV (no photo)", "Cover letter", "Visa status or AEWV eligibility", "Two referees", "NZQA qualification assessment if you have one"] },
  DE: { name: "Germany", sym: "€", per: "year", loc: "de-DE", photo: true, personal: true, visaField: true, doc: "CV", pages: "2 pages", tpl: "executive", timeZone: "Europe/Berlin",
    rules: ["A tabular CV (Lebenslauf) with a professional photo is still common", "Exact month/year dates, no gaps left unexplained", "State your German level (e.g. B2) and whether you need a work visa or EU Blue Card"],
    prompt: "Germany: 2-page tabular CV (Lebenslauf), professional photo and date of birth common, exact month/year dates, German language level stated (CEFR). Salaries in EUR per year.",
    checklist: ["Tailored CV with photo", "Motivation letter (Anschreiben)", "Degree certificates (with anabin / ZAB recognition if you have it)", "Employer references (Arbeitszeugnisse)", "German language certificate", "Work visa or EU Blue Card status"] },
  IT: { name: "Italy", sym: "€", per: "year", loc: "it-IT", photo: true, personal: true, visaField: true, doc: "CV", pages: "2 pages", tpl: "modern", timeZone: "Europe/Rome",
    rules: ["A photo is common; the Europass format is widely accepted", "Two pages, reverse-chronological, with Italian level (e.g. B2)", "Add the GDPR consent line at the bottom (autorizzo il trattamento dei dati personali)"],
    prompt: "Italy: 2-page CV (Europass-style accepted), photo common, Italian language level stated (CEFR), end with the GDPR data-processing consent line. Salaries in EUR per year (RAL).",
    checklist: ["Tailored CV with photo", "Cover letter (lettera di presentazione)", "Degree certificates (Dichiarazione di valore if asked)", "Italian language certificate", "Work-permit (nulla osta) or EU Blue Card status"] },
  XX: { name: "Another country", short: "your chosen country", sym: "", per: "month", photo: false, personal: false, doc: "CV", pages: "2 pages", tpl: "classic", timeZone: "UTC",
    rules: ["A neutral international format with no photo", "Check the local norms of the country you apply to"],
    prompt: "International: neutral 2-page CV with no photo or personal details.",
    checklist: ["Tailored CV", "Cover letter", "Passport copy", "Degree certificates", "Visa or work-permit status"] },
} satisfies Record<string, CountryRule>;

/** ISO 3166 alpha-2 code of any country in world.ts, or "XX" for "another / unknown country". */
export type CountryCode = string;
/** Popular targets shown first in pickers, then every other country A to Z. Pickers put the visitor's own country first (popularFor). */
export const COUNTRY_CODES: CountryCode[] = ["GB", "US", "CA", "AU", "NZ", "DE", "IT", "AE", "SA", "MY", "BD"];
/** The popular list with the visitor's own country (from their IP or profile) moved to the front: a UK visitor sees the UK first, a Bangladeshi visitor Bangladesh. */
export function popularFor(first?: string | null): CountryCode[] {
  const f = first && first !== "XX" && isCountry(first) ? first : null;
  return f ? [f, ...COUNTRY_CODES.filter((c) => c !== f)] : COUNTRY_CODES;
}
export const HOME_COUNTRY: CountryCode = "BD";
const HAND = COUNTRIES as Record<string, CountryRule>;

export function isCountry(c: unknown): c is CountryCode {
  return typeof c === "string" && (c === "XX" || Object.prototype.hasOwnProperty.call(WORLD_BY_CODE, c));
}
export function cc(c: unknown): CountryCode {
  const u = typeof c === "string" ? c.trim().toUpperCase() : "";
  if (u === "UK") return "GB";
  return isCountry(u) ? u : HOME_COUNTRY;
}

/** Every country, popular ones first then A to Z, for dropdowns. */
export const ALL_COUNTRIES: { code: CountryCode; name: string; popular: boolean }[] = [
  ...COUNTRY_CODES.map((code) => ({ code, name: WORLD_BY_CODE[code].name, popular: true })),
  ...WORLD.filter((w) => !COUNTRY_CODES.includes(w.code)).sort((a, b) => a.name.localeCompare(b.name)).map((w) => ({ code: w.code, name: w.name, popular: false })),
];

const SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", CNY: "¥", INR: "₹", PKR: "Rs ", LKR: "Rs ", NPR: "Rs ", KRW: "₩", PHP: "₱", NGN: "₦", TRY: "₺", ILS: "₪", THB: "฿", VND: "₫", IDR: "Rp ", ZAR: "R ", BRL: "R$", MXN: "MX$", NZD: "NZ$", SGD: "S$", HKD: "HK$", CHF: "CHF " };

type RegionRule = Omit<CountryRule, "name" | "sym" | "timeZone">;
const REGION_RULES: Record<Region, RegionRule> = {
  NA: { per: "year", photo: false, personal: false, doc: "Résumé", pages: "1–2 pages", tpl: "classic",
    rules: ["No photo, age or marital status", "One to two pages, achievements first", "State your work authorization"],
    prompt: "North America: 1-2 page résumé, no photo or personal details, achievement-first bullets. Salaries per year.",
    checklist: ["Tailored résumé (no photo)", "Cover letter", "Work authorization or sponsorship status", "References on request"] },
  EU: { per: "year", photo: false, personal: false, visaField: true, doc: "CV", pages: "2 pages", tpl: "classic",
    rules: ["Two pages, reverse-chronological", "A photo is optional; many employers prefer none", "List languages with levels (e.g. B2) and say if you need a work permit"],
    prompt: "Europe: 2-page reverse-chronological CV; photo optional (leave it out unless the user wants it); list languages with CEFR levels; state work-permit status. Salaries per year.",
    checklist: ["Tailored CV", "Cover letter (motivation letter)", "Language levels", "Degree certificates", "Work-permit or EU Blue Card status"] },
  DACH: { per: "year", photo: true, personal: true, visaField: true, doc: "CV", pages: "2 pages", tpl: "executive",
    rules: ["A professional photo and date of birth are still common", "Two pages, reverse-chronological, with exact month/year dates", "Certificates and references (Arbeitszeugnisse) are expected"],
    prompt: "Germany/Austria/Switzerland: 2-page tabular CV (Lebenslauf), professional photo and date of birth common, exact month/year dates, German language level stated. Salaries per year.",
    checklist: ["Tailored CV with photo", "Motivation letter (Anschreiben)", "Degree certificates", "Employer references (Arbeitszeugnisse)", "German language level", "Work-permit or EU Blue Card status"] },
  EE: { per: "month", photo: true, personal: true, visaField: true, doc: "CV", pages: "2 pages", tpl: "modern",
    rules: ["A photo is common", "Two pages, reverse-chronological", "List languages with levels"],
    prompt: "Eastern Europe / Central Asia: 2-page CV; a photo is common; list languages with levels. Salaries per month.",
    checklist: ["Tailored CV", "Cover letter", "Passport copy", "Degree certificates", "Work-permit status"] },
  GULF: { per: "month", photo: true, personal: true, visaField: true, doc: "CV", pages: "2 pages", tpl: "modern",
    rules: ["Photo, nationality and visa status are commonly expected", "Notice period and availability are stated up front", "Salaries are quoted per month"],
    prompt: "Gulf: 2-page CV; a professional photo and nationality/visa status are commonly included; state notice period and availability to relocate. Salaries per month.",
    checklist: ["Tailored CV with photo", "Cover letter", "Passport copy", "Attested degree certificate (needed later for the work visa)", "Experience letters from employers", "Notice period and earliest joining date"] },
  MENA: { per: "month", photo: true, personal: true, visaField: true, doc: "CV", pages: "2 pages", tpl: "modern",
    rules: ["A photo and nationality are common", "Two pages", "Mention languages (Arabic, French, English)"],
    prompt: "Middle East / North Africa: 2-page CV; a photo and nationality are common; list languages. Salaries per month.",
    checklist: ["Tailored CV with photo", "Cover letter", "Passport copy", "Degree certificates", "Experience letters"] },
  SAS: { per: "month", photo: true, personal: true, doc: "CV", pages: "1–2 pages", tpl: "modern",
    rules: ["A professional photo is common", "A short personal-details section is common", "1–2 pages for experienced professionals"],
    prompt: "South Asia: English CV, 1-2 pages; a professional photo and a short personal-details section are normal. Salaries per month.",
    checklist: ["Tailored CV", "Cover letter", "Recent passport-size photo", "Copies of academic certificates", "National ID copy", "Expected salary"] },
  SEA: { per: "month", photo: true, personal: true, visaField: true, doc: "CV", pages: "2 pages", tpl: "executive",
    rules: ["A photo is common", "Expected salary is often asked", "Two pages"],
    prompt: "Southeast Asia: 2-page CV; a photo is common; state expected monthly salary. Salaries per month.",
    checklist: ["Tailored CV", "Cover letter", "Passport copy", "Degree certificates and transcripts", "Expected salary", "Work-permit eligibility"] },
  EAS: { per: "year", photo: true, personal: true, visaField: true, doc: "CV", pages: "1–2 pages", tpl: "classic",
    rules: ["A photo is commonly expected", "Concise, factual and tidy; exact dates", "Language level (e.g. JLPT, TOPIK, HSK) matters"],
    prompt: "East Asia: concise 1-2 page CV; a photo is commonly expected; exact dates; state local-language level. Salaries per year.",
    checklist: ["Tailored CV with photo", "Cover letter", "Degree certificates", "Language certificate if any", "Visa status"] },
  OCE: { per: "year", photo: false, personal: false, visaField: true, doc: "CV", pages: "2–3 pages", tpl: "executive",
    rules: ["No photo or date of birth", "2–3 pages with key skills near the top", "Mention visa status and referees"],
    prompt: "Oceania: 2-3 page CV, no photo or date of birth, key skills near the top. Salaries per year.",
    checklist: ["Tailored CV (no photo)", "Cover letter", "Visa or sponsorship status", "Two referees"] },
  AFR: { per: "month", photo: false, personal: true, doc: "CV", pages: "2–3 pages", tpl: "classic",
    rules: ["Two to three pages", "A short personal-details section is common; a photo is optional", "List two or three referees"],
    prompt: "Africa: 2-3 page CV; short personal details common, photo optional; list referees. Salaries per month.",
    checklist: ["Tailored CV", "Cover letter", "Certified copies of certificates", "ID or passport copy", "Two or three referees"] },
  LAT: { per: "month", photo: true, personal: true, visaField: true, doc: "CV", pages: "1–2 pages", tpl: "modern",
    rules: ["A photo is common", "One to two pages", "Mention languages (Spanish, Portuguese, English)"],
    prompt: "Latin America / Caribbean: 1-2 page CV; a photo is common; list languages. Salaries per month.",
    checklist: ["Tailored CV", "Cover letter", "ID or passport copy", "Degree certificates", "Work-permit status"] },
};

const generated: Record<string, CountryRule> = {};
export function rule(c: unknown): CountryRule {
  const code = cc(c);
  if (HAND[code]) return HAND[code];
  if (generated[code]) return generated[code];
  const w = WORLD_BY_CODE[code];
  const sym = SYMBOLS[w.currency] || w.currency + " ";
  const base = REGION_RULES[w.region];
  // "Europe: 2-page CV ... Salaries per year." -> "Poland (Europe norms): 2-page CV ... Salaries in PLN per year."
  const prompt = base.prompt.replace(/^([^:]+):/, `${w.name} ($1 norms):`).replace("Salaries per", `Salaries in ${w.currency} per`);
  return (generated[code] = { ...base, name: w.name, sym, timeZone: w.timeZone, prompt });
}
export function cname(c: unknown): string {
  const r = rule(c);
  return r.short || r.name;
}
export function money(n: number | null | undefined, c: unknown): string {
  if (!n) return "";
  const r = rule(c);
  const loc = r.loc || "en-US";
  let f = NUM_FMT.get(loc);
  if (!f) { f = new Intl.NumberFormat(loc); NUM_FMT.set(loc, f); }
  return r.sym + f.format(Number(n));
}
const NUM_FMT = new Map<string, Intl.NumberFormat>();
export function perLabel(c: unknown): string {
  return rule(c).per === "year" ? "/yr" : "/mo";
}

/** Job sites whose alert emails users can forward, per target country. */
const PORTAL_TABLE: Record<string, string[]> = {
  BD: ["Bdjobs", "LinkedIn"], AE: ["Bayt", "GulfTalent", "Naukrigulf", "LinkedIn"], SA: ["Bayt", "GulfTalent", "Naukrigulf", "LinkedIn"],
  MY: ["JobStreet", "LinkedIn"], GB: ["Indeed", "Reed", "LinkedIn"], CA: ["Indeed", "Job Bank", "LinkedIn"], AU: ["SEEK", "Indeed", "LinkedIn"],
  US: ["Indeed", "LinkedIn"], XX: ["LinkedIn", "Indeed"], IN: ["Naukri", "LinkedIn", "Indeed"], NZ: ["SEEK", "LinkedIn"],
  SG: ["JobStreet", "LinkedIn"], PH: ["JobStreet", "LinkedIn"], ID: ["JobStreet", "LinkedIn"], DE: ["StepStone", "LinkedIn", "Indeed"],
};
const REGION_PORTALS: Partial<Record<Region, string[]>> = { GULF: ["Bayt", "GulfTalent", "Naukrigulf", "LinkedIn"], MENA: ["Bayt", "LinkedIn"], SEA: ["JobStreet", "LinkedIn"], DACH: ["StepStone", "LinkedIn", "Indeed"] };
export function portals(c: unknown): string[] {
  const code = cc(c);
  return PORTAL_TABLE[code] || REGION_PORTALS[WORLD_BY_CODE[code]?.region] || ["LinkedIn", "Indeed"];
}

export const ACCENTS: [string, string][] = [["#0B7A6E", "Teal"], ["#1E3A5F", "Navy"], ["#7A2E3A", "Burgundy"], ["#2F3B45", "Charcoal"]];
export const TEMPLATES: [CvTemplate, string][] = [["modern", "Modern sidebar"], ["executive", "Executive"], ["classic", "Classic (ATS-safe)"]];
export const isAccent = (a: unknown): a is string => typeof a === "string" && ACCENTS.some(([c]) => c === a);
export const isTemplate = (t: unknown): t is CvTemplate => t === "modern" || t === "executive" || t === "classic";
