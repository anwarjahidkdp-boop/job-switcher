// Vocabulary and taxonomy used by extraction prompts and deterministic matching (ported from the prototype).
export const CATEGORIES = ["Finance & Accounting", "HR", "Marketing", "Sales", "Operations", "Supply Chain", "IT", "Engineering", "Administration", "Banking & Financial Services", "Garments & Textile", "Healthcare", "Education", "Customer Service", "Legal", "Hospitality", "Other"];
export const INDUSTRIES = "textile & garments, manufacturing, fmcg, pharmaceuticals, food & beverage, steel, ceramics, cement, energy, banking, telecom, technology, hospitality, ngo, retail, logistics, healthcare, construction, education";
export const INDUSTRY_LIST = INDUSTRIES.split(", ");

export const SKILL_LABEL: Record<string, string> = { "vat & tax": "VAT & Tax", "advanced excel": "Advanced Excel", "power bi": "Power BI", sap: "SAP", erp: "ERP", "tally erp": "Tally ERP", ifrs: "IFRS", sql: "SQL", hris: "HRIS", "ms office": "MS Office", "rest apis": "REST APIs", "node.js": "Node.js", "bangladesh labour law": "Bangladesh Labour Law", crm: "CRM", seo: "SEO" };
export const cap1 = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
export const skillLabel = (s: string) => SKILL_LABEL[s] || cap1(s);

export const SKILL_ALIAS: Record<string, string> = { excel: "advanced excel", "ms excel": "advanced excel", "ms excel (advanced)": "advanced excel", vat: "vat & tax", tax: "vat & tax", "vat/tax": "vat & tax", "income tax": "vat & tax", tally: "tally erp", "tally erp 9": "tally erp", powerbi: "power bi", "ms word": "ms office", "microsoft office": "ms office", budget: "budgeting", forecasting: "cash flow forecasting", "team leadership": "team management", supervision: "team management", "people management": "team management" };
export const normSkill = (s: unknown) => {
  const k = String(s || "").toLowerCase().trim();
  return SKILL_ALIAS[k] || k;
};

export const RELATED: Record<string, string[]> = { erp: ["tally erp", "sap", "oracle", "odoo"], sap: ["erp", "oracle", "tally erp"], oracle: ["sap", "erp"], "financial modelling": ["budgeting"], budgeting: ["financial modelling"], "cash flow forecasting": ["budgeting", "treasury management"], "treasury management": ["cash flow forecasting"], "cost accounting": ["management reporting"] };

export const VOCAB = ["financial reporting", "management reporting", "bank reconciliation", "vat & tax", "advanced excel", "team management", "budgeting", "financial modelling", "power bi", "erp", "sap", "tally erp", "ifrs", "internal audit", "risk management", "general ledger", "accounts payable", "accounts receivable", "cost accounting", "treasury management", "cash flow forecasting", "sql", "talent acquisition", "employee relations", "bangladesh labour law", "hris", "payroll", "brand management", "market research", "digital marketing", "procurement", "inventory management", "merchandising", "node.js", "rest apis", "sales management", "territory planning", "key account management", "facilities management", "vendor management", "ms office"];

export const FAMILIES = [
  ["accounts", "accounting", "accountant", "finance", "financial", "tax", "vat", "audit", "auditor", "treasury", "fp&a", "costing", "controller", "bookkeeper"],
  ["hr", "human", "resources", "people", "talent", "recruitment", "payroll", "compensation", "learning", "partner"],
  ["marketing", "brand", "digital", "communications", "content", "product"],
  ["sales", "business", "development", "territory", "area", "key", "account"],
  ["supply", "chain", "procurement", "logistics", "merchandising", "merchandiser", "sourcing", "inventory", "warehouse"],
  ["software", "engineer", "developer", "backend", "frontend", "it", "data", "systems", "devops"],
  ["admin", "administration", "office", "facilities"],
];
export const TITLE_STOP = new Set(["senior", "sr", "sr.", "assistant", "asst", "asst.", "manager", "executive", "officer", "head", "of", "and", "&", "lead", "junior", "jr", "deputy", "general", "specialist", "associate", "principal", "-", ",", "/", "(", ")"]);
export const titleTokens = (t: unknown) => String(t || "").toLowerCase().replace(/[(),/]/g, " ").split(/\s+/).filter((w) => w && !TITLE_STOP.has(w));
export const famOf = (w: string) => FAMILIES.findIndex((f) => f.includes(w));

// Words that say how senior a role is but not what it is ("Director, Strategic Finance").
const TITLE_GENERIC = new Set(["director", "vp", "svp", "evp", "president", "chief", "team", "global", "regional", "staff", "intern", "trainee", "graduate"]);
/**
 * The part of a job title that names the role. Titles often add a team or product after a separator:
 * "Software Engineer, Bill Pay & Procurement", "Account Manager | Commercial", "Engineer - Codex for Finance".
 * Those trailing words say where the role sits, not what it is, so matching and categories read the head.
 * When the head is only a level ("Director, Strategic Finance"), the next part names the role.
 */
export function roleHead(title: unknown): string {
  const parts = String(title || "").split(/\s*(?:[,|(\u2013\u2014]|\s-\s|:)\s*/).map((x) => x.replace(/\)/g, " ").trim()).filter(Boolean);
  for (const p of parts) if (titleTokens(p).some((w) => !TITLE_GENERIC.has(w))) return p;
  return String(title || "");
}

export const LEVEL = { entry: 0, mid: 1, senior: 2, manager: 3, head: 4 } as const;
export type Seniority = keyof typeof LEVEL;
export const LEVEL_NAME = ["entry level", "mid level", "senior level", "manager level", "head level"];
export const isSeniority = (s: unknown): s is Seniority => typeof s === "string" && s in LEVEL;

export const EDU = { hsc: 0, diploma: 1, bachelors: 2, masters: 3, phd: 4 } as const;
export type EduLevel = keyof typeof EDU;
export const isEduLevel = (s: unknown): s is EduLevel => typeof s === "string" && s in EDU;

export const IND_GROUP: Record<string, string> = { "textile & garments": "industry", manufacturing: "industry", fmcg: "industry", pharmaceuticals: "industry", "food & beverage": "industry", steel: "industry", ceramics: "industry", cement: "industry", energy: "industry", banking: "services", telecom: "services", technology: "services", hospitality: "services", ngo: "services", retail: "services", logistics: "services", healthcare: "services", education: "services", construction: "industry" };
export const DIVISION: Record<string, string[]> = { dhaka: ["dhaka", "gazipur", "narayanganj", "savar", "tongi", "tejgaon", "gulshan", "motijheel", "uttara"], chattogram: ["chattogram", "chittagong", "cox's bazar"], sylhet: ["sylhet"], khulna: ["khulna", "jessore"], rajshahi: ["rajshahi", "bogura"] };
export const divOf = (l: unknown) => {
  const k = String(l || "").toLowerCase();
  return Object.keys(DIVISION).find((d) => DIVISION[d].some((x) => k.includes(x))) || k;
};
