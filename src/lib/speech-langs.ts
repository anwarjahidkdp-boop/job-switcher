// Languages offered for speaking (or writing) a CV change, from the country the person lives in.
// English is always offered; a second language only where it is the country's main language (English-speaking
// countries get English only). Codes are BCP 47 tags the browser's speech recognition understands.
import { cc } from "./countries";

export interface SpeechLang { code: string; label: string; english: boolean }

const ENGLISH: Record<string, string> = { GB: "en-GB", US: "en-US", CA: "en-CA", AU: "en-AU", NZ: "en-NZ", IE: "en-IE", IN: "en-IN", ZA: "en-ZA", SG: "en-SG", PH: "en-PH", NG: "en-NG", KE: "en-KE", PK: "en-PK" };

const LOCAL: Record<string, [string, string]> = {
  BD: ["bn-BD", "বাংলা"], IN: ["hi-IN", "हिन्दी"], PK: ["ur-PK", "اردو"], NP: ["ne-NP", "नेपाली"], LK: ["si-LK", "සිංහල"],
  AE: ["ar-AE", "العربية"], SA: ["ar-SA", "العربية"], QA: ["ar-QA", "العربية"], KW: ["ar-KW", "العربية"], OM: ["ar-OM", "العربية"], BH: ["ar-BH", "العربية"], EG: ["ar-EG", "العربية"], JO: ["ar-JO", "العربية"],
  DE: ["de-DE", "Deutsch"], AT: ["de-AT", "Deutsch"], CH: ["de-CH", "Deutsch"], IT: ["it-IT", "Italiano"], FR: ["fr-FR", "Français"], ES: ["es-ES", "Español"], PT: ["pt-PT", "Português"],
  NL: ["nl-NL", "Nederlands"], BE: ["nl-BE", "Nederlands"], PL: ["pl-PL", "Polski"], SE: ["sv-SE", "Svenska"], NO: ["nb-NO", "Norsk"], DK: ["da-DK", "Dansk"], FI: ["fi-FI", "Suomi"],
  CZ: ["cs-CZ", "Čeština"], HU: ["hu-HU", "Magyar"], RO: ["ro-RO", "Română"], GR: ["el-GR", "Ελληνικά"], TR: ["tr-TR", "Türkçe"],
  MX: ["es-MX", "Español"], AR: ["es-AR", "Español"], CO: ["es-CO", "Español"], CL: ["es-CL", "Español"], PE: ["es-PE", "Español"], BR: ["pt-BR", "Português"],
  MY: ["ms-MY", "Bahasa Melayu"], ID: ["id-ID", "Bahasa Indonesia"], TH: ["th-TH", "ไทย"], VN: ["vi-VN", "Tiếng Việt"],
  JP: ["ja-JP", "日本語"], CN: ["zh-CN", "中文"], TW: ["zh-TW", "中文"], HK: ["zh-HK", "中文"], KR: ["ko-KR", "한국어"],
};

export function speechLangs(livesIn: unknown): SpeechLang[] {
  const c = cc(livesIn);
  const out: SpeechLang[] = [{ code: ENGLISH[c] || "en-GB", label: "English", english: true }];
  const l = LOCAL[c];
  if (l) out.push({ code: l[0], label: l[1], english: false });
  return out;
}

/** Language name for the translation prompt, from a speech code ("bn-BD" -> "Bangla"). Unknown codes are refused. */
export function langName(code: unknown): string | null {
  if (typeof code !== "string" || !/^[a-z]{2,3}(-[A-Z]{2})?$/.test(code) || code.startsWith("en")) return null;
  const known = Object.values(LOCAL).some(([k]) => k === code);
  if (!known) return null;
  if (code.startsWith("bn")) return "Bangla";
  try { return new Intl.DisplayNames(["en"], { type: "language" }).of(code.split("-")[0]) || null; } catch { return null; }
}
