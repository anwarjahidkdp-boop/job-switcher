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
    { day: 1, title: "Get your new CV", why: "Rebuilt in your target country's format from your real experience.", done: i.hasMaster, href: "/profile", cta: "See my CV" },
    { day: 1, title: "Look at your best matches", why: "Jobs ranked by how well they fit your verified profile.", done: i.prepared > 0 || i.applied > 0, href: "/inbox#matches", cta: "See matches" },
    { day: 2, title: "Review your ready applications", why: "We tailor your CV and cover letter for each strong match. You check and apply.", done: i.applied > 0, href: "/queue", cta: "Open Apply Queue" },
    { day: 3, title: "Turn on job alerts", why: "New jobs from job sites arrive here on their own every day.", done: i.setupDone, href: "/setup", cta: "Set up alerts" },
    { day: 3, title: "Apply to 3 jobs", why: `More good applications mean more interview calls. ${Math.min(i.applied, 3)} of 3 done.`, done: i.applied >= 3, href: "/queue", cta: "Apply now" },
    { day: 4, title: "Tell us about replies", why: "Got a call? Tell us and we prepare your interview answers.", done: i.applied > 0 && i.repliesPending === 0, href: "/applications", cta: "Update applications" },
    { day: 5, title: "See what JobPao did for you", why: "Your trial in numbers, and how to keep your assistant working.", done: i.status === "active", href: "/inbox#trial", cta: "See my results" },
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
