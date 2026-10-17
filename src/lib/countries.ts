// Target-country rules, ported from the prototype COUNTRIES table.
// The same data is seeded into the `country_rules` table (supabase/migrations/0003_seed_country_rules.sql);
// this file is the typed source used by code and tests. Keep both in sync.

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
  XX: { name: "Another country", short: "your chosen country", sym: "", per: "month", photo: false, personal: false, doc: "CV", pages: "2 pages", tpl: "classic", timeZone: "UTC",
    rules: ["A neutral international format with no photo", "Check the local norms of the country you apply to"],
    prompt: "International: neutral 2-page CV with no photo or personal details.",
    checklist: ["Tailored CV", "Cover letter", "Passport copy", "Degree certificates", "Visa or work-permit status"] },
} satisfies Record<string, CountryRule>;

export type CountryCode = keyof typeof COUNTRIES;
export const COUNTRY_CODES = Object.keys(COUNTRIES) as CountryCode[];
export const HOME_COUNTRY: CountryCode = "BD";

export function isCountry(c: unknown): c is CountryCode {
  return typeof c === "string" && Object.prototype.hasOwnProperty.call(COUNTRIES, c);
}
export function cc(c: unknown): CountryCode {
  return isCountry(c) ? c : HOME_COUNTRY;
}
export function rule(c: unknown): CountryRule {
  return COUNTRIES[cc(c)];
}
export function cname(c: unknown): string {
  const r = rule(c);
  return r.short || r.name;
}
export function money(n: number | null | undefined, c: unknown): string {
  if (!n) return "";
  const r = rule(c);
  return r.sym + Number(n).toLocaleString(r.loc || "en-US");
}
export function perLabel(c: unknown): string {
  return rule(c).per === "year" ? "/yr" : "/mo";
}

/** Job sites whose alert emails users can forward, per target country. */
export const PORTALS: Record<CountryCode, string[]> = {
  BD: ["Bdjobs", "LinkedIn"], AE: ["Bayt", "GulfTalent", "Naukrigulf", "LinkedIn"], SA: ["Bayt", "GulfTalent", "Naukrigulf", "LinkedIn"],
  MY: ["JobStreet", "LinkedIn"], GB: ["Indeed", "Reed", "LinkedIn"], CA: ["Indeed", "Job Bank", "LinkedIn"], AU: ["SEEK", "Indeed", "LinkedIn"],
  US: ["Indeed", "LinkedIn"], XX: ["LinkedIn", "Indeed"],
};

export const ACCENTS: [string, string][] = [["#0B7A6E", "Teal"], ["#1E3A5F", "Navy"], ["#7A2E3A", "Burgundy"], ["#2F3B45", "Charcoal"]];
export const TEMPLATES: [CvTemplate, string][] = [["modern", "Modern sidebar"], ["executive", "Executive"], ["classic", "Classic (ATS-safe)"]];
export const isAccent = (a: unknown): a is string => typeof a === "string" && ACCENTS.some(([c]) => c === a);
export const isTemplate = (t: unknown): t is CvTemplate => t === "modern" || t === "executive" || t === "classic";
