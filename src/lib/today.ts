// The 5-day trial plan and the "Today for you" list on the dashboard. Pure functions so they can be tested.
const DAY = 86_400_000;

export interface PlanInput {
  status: string | null; trialStart: string | null; trialEnd: string | null; now: number;
  hasMaster: boolean; strong: number; prepared: number; applied: number; interviews: number; setupDone: boolean; repliesPending: number;
}
export interface PlanStep { day: number; title: string; why: string; done: boolean; href: string; cta: string }
export interface Plan { day: number; ended: boolean; steps: PlanStep[]; next: PlanStep | null; summaryTime: boolean }

/** Days in the free trial (owner decision 2026-10-21: 5 days, one AI-tailored application a day). */
export const TRIAL_DAYS = 5;

/** Which day of the trial it is (1 to TRIAL_DAYS), or null outside a trial. */
export function trialDay(i: Pick<PlanInput, "status" | "trialStart" | "trialEnd" | "now">): number | null {
  if (i.status !== "trialing" || !i.trialEnd) return null;
  const start = i.trialStart ? Date.parse(i.trialStart) : Date.parse(i.trialEnd) - TRIAL_DAYS * DAY;
  return Math.min(TRIAL_DAYS, Math.max(1, Math.floor((i.now - start) / DAY) + 1));
}

export function trialPlan(i: PlanInput): Plan | null {
  const day = trialDay(i);
  if (day == null) return null;
  const ended = !!i.trialEnd && Date.parse(i.trialEnd) <= i.now;
  const steps: PlanStep[] = [
    { day: 1, title: "Build your Career Agent", why: "Your Master CV and verified career profile become the safe source for every match and application.", done: i.hasMaster, href: "/profile", cta: "See my profile" },
    { day: 2, title: "Discover relevant opportunities", why: "JobPao keeps analysing current jobs against your role, skills and preferences.", done: i.strong > 0, href: "/inbox#matches", cta: "See opportunities" },
    { day: 3, title: "Prove the fit", why: "Open Why This Job to see evidence, requirements and gaps instead of a black-box score.", done: i.strong > 0, href: "/inbox#matches", cta: "See why they fit" },
    { day: 4, title: "Act on the best opportunity", why: "Review a tailored CV, cover letter and application safety check before you submit.", done: i.prepared > 0 || i.applied > 0, href: "/queue", cta: "Open Apply Queue" },
    { day: 5, title: "Your First 5 Days with JobPao", why: "See jobs analysed, relevant opportunities, strong matches and applications prepared or confirmed sent.", done: i.status === "active", href: "/inbox#trial", cta: "See my 5-day results" },
  ];
  // The next step is the first undone step that is due by today; if all due steps are done, the first undone one.
  const next = steps.find((s) => !s.done && s.day <= day) || steps.find((s) => !s.done) || null;
  return { day, ended, steps, next, summaryTime: day >= TRIAL_DAYS || ended };
}

/** Course search links for a skill. Search pages only: we never invent a specific course. */
export function courseLinks(skill: string): { label: string; href: string }[] {
  const q = encodeURIComponent(skill);
  return [
    { label: "Coursera", href: `https://www.coursera.org/search?query=${q}` },
    { label: "LinkedIn Learning", href: `https://www.linkedin.com/learning/search?keywords=${q}` },
    { label: "YouTube (free)", href: `https://www.youtube.com/results?search_query=${encodeURIComponent(skill + " full course")}` },
  ];
}

/** Current time, read outside render code (server components call this once per request). */
export const nowMs = () => Date.now();
