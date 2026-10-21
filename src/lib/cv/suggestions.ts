// Recommendations from the CV writer that only the person can confirm (a status, a title, a language level).
// Applying one replaces that exact text on the Master CV with the option the person chose.
import type { CvSuggestion, MasterCV } from "../types";

type Raw = { section?: unknown; current?: unknown; options?: unknown; reason?: unknown };
const str = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** Every text field a suggestion may point at, as [read, write] pairs. */
function slots(m: MasterCV): { get: () => string; set: (v: string) => void }[] {
  const out: { get: () => string; set: (v: string) => void }[] = [
    { get: () => m.headline || "", set: (v) => { m.headline = v; } },
    { get: () => m.summary || "", set: (v) => { m.summary = v; } },
  ];
  const list = (a: string[]) => a.forEach((_, i) => out.push({ get: () => a[i], set: (v) => { a[i] = v; } }));
  list(m.education || []); list(m.certifications || []); list(m.languages || []); list(m.skills_core || []); list(m.skills_tools || []);
  for (const e of m.experience || []) {
    out.push({ get: () => e.title || "", set: (v) => { e.title = v; } });
    list(e.bullets || []);
  }
  return out;
}

const findSlot = (m: MasterCV, current: string) => slots(m).find((s) => s.get().includes(current));

/** Keeps suggestions whose text is still on the CV and that offer a real change; gives each a stable id. */
export function cleanSuggestions(m: MasterCV, raw: unknown, max = 5): CvSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const out: CvSuggestion[] = [];
  for (const r of raw as Raw[]) {
    const current = str(r?.current, 600);
    const options = (Array.isArray(r?.options) ? r.options : []).map((o) => str(o, 600)).filter((o, i, a) => o && o !== current && a.indexOf(o) === i).slice(0, 3);
    if (current.length < 3 || !options.length || !findSlot(m, current) || out.some((s) => s.current === current)) continue;
    out.push({ id: `s${out.length + 1}`, section: str(r?.section, 60) || "CV", current, options, reason: str(r?.reason, 200) });
    if (out.length >= max) break;
  }
  return out;
}

/** The CV with the chosen option in place of the suggestion's text, minus that suggestion; null if the text is no longer there. */
export function applySuggestion(m: MasterCV, id: string, option: number): { master: MasterCV; edit: string } | null {
  const s = (m.suggestions || []).find((x) => x.id === id);
  const choice = s?.options[option];
  if (!s || !choice) return null;
  const next: MasterCV = JSON.parse(JSON.stringify(m));
  const slot = findSlot(next, s.current);
  if (!slot) return null;
  slot.set(slot.get().replace(s.current, choice));
  next.suggestions = (next.suggestions || []).filter((x) => x.id !== id);
  return { master: next, edit: `Change "${s.current}" to "${choice}"` };
}

export function dismissSuggestion(m: MasterCV, id: string): MasterCV {
  return { ...m, suggestions: (m.suggestions || []).filter((x) => x.id !== id) };
}
