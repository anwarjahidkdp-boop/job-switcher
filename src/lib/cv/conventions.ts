// Country CV conventions that change what the finished CV contains and how it prints: paper size and margins,
// which personal details appear, references, a closing declaration, a signature line and consent text.
// Sources per country are listed in docs/cv-conventions.md. Everything shown comes from what the person typed;
// nothing here is ever generated.
import { cc, rule } from "../countries";
import { WORLD_BY_CODE, type Region } from "../world";
import type { PersonalDetails, Referee } from "../types";

export type PField = "fatherName" | "motherName" | "dob" | "nationality" | "marital" | "religion" | "address" | "visa" | "licence" | "notice";

export interface CvConvention {
  paper: "A4" | "Letter";
  /** CSS @page margins (top right bottom left) for layouts without a full-bleed band. */
  margin: string;
  /** Personal-detail rows in the order they appear, each shown only when the person filled it. */
  fields: PField[];
  /** Label of the visa row: "Right to work" in the UK, "Work authorization" in the US. */
  visaLabel: string;
  /** References: "list" names the person's referees (or "Available on request" until they add some), "request" only says they are available, "none" leaves them out. */
  refs: "list" | "request" | "none";
  /** How many referees employers expect when they are listed. */
  refCount: number;
  /** Closing truth declaration (South Asia). */
  declaration: boolean;
  /** Name, place/date and signature line at the end (Bangladesh, South Asia, Germany). */
  sign: boolean;
  /** Data-protection consent line some countries expect at the foot of the CV. */
  consent?: string;
  /** Date format for the signature line. */
  dateLocale: string;
}

const BASE: CvConvention = { paper: "A4", margin: "16mm 18mm 15mm 18mm", fields: ["visa"], visaLabel: "Work authorization", refs: "none", refCount: 2, declaration: false, sign: false, dateLocale: "en-GB" };

const SOUTH_ASIA: Partial<CvConvention> = { fields: ["dob", "nationality", "marital"], visaLabel: "Visa status", refs: "request" };
const GULF: Partial<CvConvention> = { fields: ["nationality", "dob", "marital", "visa", "licence", "notice"], visaLabel: "Visa status", refs: "request" };
const US_MARGIN = "0.7in 0.75in 0.6in 0.75in";

const REGION: Record<Region, Partial<CvConvention>> = {
  NA: { paper: "Letter", margin: US_MARGIN, fields: ["visa"], visaLabel: "Work authorization" },
  EU: { fields: ["nationality", "visa", "licence"], visaLabel: "Work permit" },
  DACH: { margin: "20mm 20mm 18mm 25mm", fields: ["dob", "nationality", "visa", "licence"], visaLabel: "Work permit", sign: true, dateLocale: "de-DE" },
  EE: { fields: ["dob", "nationality", "visa"], visaLabel: "Work permit" },
  GULF,
  MENA: { ...GULF, fields: ["nationality", "dob", "marital", "visa", "licence"] },
  SAS: SOUTH_ASIA,
  SEA: { fields: ["nationality", "visa", "notice"], visaLabel: "Work pass", refs: "request" },
  EAS: { fields: ["dob", "nationality", "visa"], visaLabel: "Visa status" },
  OCE: { fields: ["visa", "licence"], visaLabel: "Work rights", refs: "request" },
  AFR: { fields: ["nationality", "licence", "visa"], visaLabel: "Work permit", refs: "list", refCount: 2 },
  LAT: { fields: ["dob", "nationality", "visa"], visaLabel: "Work permit" },
};

/** Hand-checked countries (October 2026 research, sources in docs/cv-conventions.md). These keep their own fields even where the region leaves personal details out. */
const COUNTRY: Record<string, Partial<CvConvention>> = {
  // Bangladesh: father's and mother's names, two non-related referees, declaration, date and signature (BUTEX/AIUB formats).
  BD: { fields: ["fatherName", "motherName", "dob", "nationality", "marital", "religion", "address"], visaLabel: "Visa status", refs: "list", refCount: 2, declaration: true, sign: true },
  // India private-sector résumés leave out father's name, religion and the declaration; notice period is expected.
  IN: { fields: ["nationality", "visa", "notice"], refs: "request" },
  PK: { fields: ["dob", "nationality", "marital", "notice"], refs: "list", refCount: 2 },
  LK: { fields: ["dob", "nationality", "marital"], refs: "list", refCount: 2, declaration: true, sign: true },
  NP: { fields: ["nationality", "visa"], refs: "request" },
  AE: GULF, SA: GULF, QA: GULF, KW: GULF, OM: GULF, BH: GULF,
  // Malaysia: references with name, title, phone, email and relationship (Jobstreet); no IC, race or religion.
  MY: { fields: ["nationality", "visa", "notice"], visaLabel: "Work pass", refs: "list", refCount: 3 },
  // Singapore: never NRIC, race, religion or marital status (PDPA, TAFEP).
  SG: { fields: ["nationality", "visa", "notice"], visaLabel: "Work pass", refs: "request" },
  PH: { paper: "Letter", margin: US_MARGIN, fields: ["nationality", "visa"], refs: "list", refCount: 3 },
  // UK: no DOB, nationality or marital status; "References available on request" (National Careers Service).
  GB: { margin: "18mm 18mm 16mm 18mm", fields: ["visa"], visaLabel: "Right to work", refs: "request" },
  IE: { fields: ["visa"], visaLabel: "Right to work", refs: "list", refCount: 2 },
  // US and Canada: references go on a separate sheet, never on the résumé.
  US: { paper: "Letter", margin: US_MARGIN, fields: ["visa"], visaLabel: "Work authorization", refs: "none" },
  CA: { paper: "Letter", margin: US_MARGIN, fields: ["visa"], visaLabel: "Work authorization", refs: "none" },
  // Australia: two referees with title, organisation, relationship, phone and email (Australian Government guide).
  AU: { fields: ["visa", "licence"], visaLabel: "Work rights", refs: "list", refCount: 2 },
  // New Zealand: referee contact details stay off the CV until asked (SEEK NZ).
  NZ: { fields: ["visa", "licence"], visaLabel: "Work rights", refs: "request" },
  DE: REGION.DACH, AT: REGION.DACH,
  CH: { ...REGION.DACH, visaLabel: "Work permit (L/B/C)", refs: "request", sign: false },
  NL: { fields: ["dob", "nationality", "visa"], visaLabel: "Work permit" },
  FR: { fields: ["visa", "licence"], visaLabel: "Work permit" },
  ES: { fields: ["dob", "nationality", "licence", "visa"], visaLabel: "Work permit", refs: "request" },
  // Italy: GDPR consent line at the foot and a signed CV (Randstad Italia).
  IT: { fields: ["dob", "nationality", "visa", "licence"], visaLabel: "Work permit", sign: true, dateLocale: "it-IT",
    consent: "Autorizzo il trattamento dei dati personali contenuti nel mio curriculum vitae ai sensi del D.Lgs. 196/2003 e dell'art. 13 del Regolamento UE 2016/679 (GDPR)." },
  ZA: { fields: ["nationality", "licence", "visa"], visaLabel: "Work permit", refs: "list", refCount: 3 },
  NG: { fields: ["nationality", "visa"], visaLabel: "Work permit", refs: "request" },
  KE: { fields: ["nationality", "visa"], visaLabel: "Work permit", refs: "list", refCount: 3 },
};

export function convention(c: unknown): CvConvention {
  const code = cc(c);
  const region = WORLD_BY_CODE[code]?.region;
  const out = { ...BASE, ...(region ? REGION[region] : {}), ...(COUNTRY[code] || {}) };
  // Other countries whose CVs leave personal details out keep only work status, licence and notice.
  if (!COUNTRY[code] && !rule(code).personal) out.fields = out.fields.filter((f) => f === "visa" || f === "licence" || f === "notice");
  return out;
}

export const FIELD_LABEL: Record<Exclude<PField, "visa">, string> = {
  fatherName: "Father's name", motherName: "Mother's name", dob: "Date of birth", nationality: "Nationality",
  marital: "Marital status", religion: "Religion", address: "Permanent address", licence: "Driving licence", notice: "Notice period",
};

export const fieldLabel = (f: PField, cv: CvConvention) => (f === "visa" ? cv.visaLabel : FIELD_LABEL[f]);

/** The personal-detail rows that will appear on the CV, in order. */
export function personalRows(cv: CvConvention, pd: PersonalDetails | null | undefined, noticeDays?: number | null): [string, string][] {
  const p = pd || {};
  return cv.fields.map((f): [string, string] => {
    if (f === "notice") return [FIELD_LABEL.notice, noticeDays ? `${noticeDays} days` : ""];
    return [fieldLabel(f, cv), String(p[f] || "").trim()];
  }).filter(([, v]) => v);
}

/** Referees with at least a name and one way to reach them or their organisation, capped at what employers expect. */
export function cleanReferees(r: unknown, max = 3): Referee[] {
  if (!Array.isArray(r)) return [];
  const s = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
  return r.map((x) => ({ name: s(x?.name, 80), title: s(x?.title, 100), org: s(x?.org, 120), phone: s(x?.phone, 40), email: s(x?.email, 120), relation: s(x?.relation, 60) }))
    .filter((x) => x.name && (x.phone || x.email || x.org)).slice(0, max);
}

const STR_FIELDS = ["fatherName", "motherName", "dob", "nationality", "marital", "religion", "address", "visa", "licence"] as const;
/**
 * Applies what the preferences form sent to the stored details: only keys the form sent change (a blank box clears
 * that item), so details kept for another country survive a form that does not show them.
 */
export function mergePersonal(existing: PersonalDetails | null | undefined, input: unknown): PersonalDetails {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: PersonalDetails = {};
  const prev = existing || {};
  for (const k of STR_FIELDS) {
    const v = (k in o ? String(o[k] ?? "") : String(prev[k] ?? "")).trim().slice(0, k === "address" ? 200 : 120);
    if (v) out[k] = v;
  }
  const refs = cleanReferees("references" in o ? o.references : prev.references);
  if (refs.length) out.references = refs;
  return out;
}

export const DECLARATION = "I hereby declare that the information given above is true and correct to the best of my knowledge and belief.";

export function signDate(cv: CvConvention, d: Date): string {
  return d.toLocaleDateString(cv.dateLocale, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

const HINT: Record<Exclude<PField, "notice" | "visa">, string> = {
  fatherName: "e.g. Md. Abdul Karim", motherName: "e.g. Rokeya Begum", dob: "e.g. 12 March 1992", nationality: "e.g. Bangladeshi",
  marital: "e.g. Married", religion: "e.g. Islam", address: "e.g. Village, Upazila, District", licence: "e.g. Full driving licence (light vehicle)",
};
const VISA_HINT: Record<string, string> = {
  "Right to work": "e.g. British citizen, or Requires Skilled Worker sponsorship",
  "Work authorization": "e.g. Authorized to work in the US, or Requires H-1B sponsorship",
  "Work rights": "e.g. Australian PR, or Requires employer-sponsored visa",
  "Work pass": "e.g. Requires Employment Pass",
};
/** The boxes the preferences form shows for this country (notice period has its own box there). */
export function personalFields(c: unknown): { k: Exclude<PField, "notice">; label: string; hint: string }[] {
  const cv = convention(c);
  return cv.fields.filter((f): f is Exclude<PField, "notice"> => f !== "notice")
    .map((k) => ({ k, label: fieldLabel(k, cv), hint: k === "visa" ? VISA_HINT[cv.visaLabel] || "e.g. Requires employment visa" : HINT[k] }));
}
