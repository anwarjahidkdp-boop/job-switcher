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
] as const;
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
