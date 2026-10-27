// The one place that says which gaps the person can close themselves, and where: the job page's gap list and its eligibility note use it.
export interface GapAction { href: string; label: string }

const SALARY: GapAction = { href: "/profile#application-safety", label: "Update salary" };
const BIRTH: GapAction = { href: "/profile#application-safety", label: "Add date of birth" };

const BY_CODE: Record<string, GapAction> = {
  sal: SALARY, salary: SALARY, salary_unpublished: SALARY, salary_range: SALARY, salary_near: SALARY, salary_unknown: SALARY,
  age_unknown: BIRTH,
};

export function gapAction(code: string): GapAction | null {
  return BY_CODE[code] ?? null;
}
