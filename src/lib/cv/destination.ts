import { cc } from "../countries";
import type { MasterCV } from "../types";

// Presentation only: localise prose, never names, titles, qualifications, dates, figures or career facts.
const SPELLING = [
  ["organize", "organise"], ["organized", "organised"], ["organizing", "organising"],
  ["organization", "organisation"], ["organizations", "organisations"],
  ["analyze", "analyse"], ["analyzed", "analysed"], ["analyzing", "analysing"],
  ["optimize", "optimise"], ["optimized", "optimised"], ["optimizing", "optimising"],
  ["specialize", "specialise"], ["specialized", "specialised"], ["specializing", "specialising"],
  ["prioritize", "prioritise"], ["prioritized", "prioritised"], ["prioritizing", "prioritising"],
  // UK-first launch (2026-11-11): the -ize/-yze verbs and US spellings that most often appear in CV bullets.
  ...["realiz", "recogniz", "utiliz", "minimiz", "maximiz", "standardiz", "finaliz", "summariz", "customiz", "categoriz", "centraliz", "mobiliz", "moderniz", "authoriz", "emphasiz", "harmoniz", "digitiz", "capitaliz", "familiariz", "computeriz", "synchroniz", "visualiz", "systematiz", "incentiviz"]
    .flatMap((stem) => (["e", "ed", "es", "ing", "ation", "ations"] as const).map((end): [string, string] => [`${stem}${end}`, `${stem.slice(0, -1)}s${end}`])),
  ["paralyze", "paralyse"], ["catalyzed", "catalysed"],
  ["behavior", "behaviour"], ["behaviors", "behaviours"], ["behavioral", "behavioural"], ["labor", "labour"], ["favorable", "favourable"],
  ["color", "colour"], ["honor", "honour"], ["endeavor", "endeavour"], ["endeavors", "endeavours"], ["neighborhood", "neighbourhood"],
  ["fulfill", "fulfil"], ["fulfillment", "fulfilment"], ["enrollment", "enrolment"], ["enrollments", "enrolments"], ["installment", "instalment"],
  ["modeling", "modelling"], ["modeled", "modelled"], ["traveled", "travelled"], ["traveling", "travelling"], ["canceled", "cancelled"], ["canceling", "cancelling"],
  ["labeled", "labelled"], ["labeling", "labelling"], ["counseling", "counselling"], ["counselor", "counsellor"], ["fueled", "fuelled"],
  ["catalog", "catalogue"], ["catalogs", "catalogues"], ["defense", "defence"], ["offense", "offence"], ["practicing", "practising"],
] as [string, string][];
export function destinationProse(value: string, country: unknown): string {
  const code = cc(country);
  if (code !== "GB" && code !== "US") return value;
  const pairs = SPELLING.map(([us, gb]): [string, string] => code === "GB" ? [us, gb] : [gb, us]);
  const replacements = new Map(pairs);
  const pattern = new RegExp(`\\b(${pairs.map(([from]) => from).join("|")})\\b`, "gi");
  return value.replace(pattern, word => {
    const replacement = replacements.get(word.toLowerCase())!;
    return word === word.toUpperCase() ? replacement.toUpperCase() : /^[A-Z]/.test(word) ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
  });
}
export function destinationMaster(master: MasterCV, country: unknown): MasterCV {
  return { ...master, summary: destinationProse(master.summary || "", country),
    experience: (master.experience || []).map(role => ({ ...role, bullets: (role.bullets || []).map(b => destinationProse(b, country)) })) };
}
