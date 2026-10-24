/** Reverse chronology without changing dates or inferring that a role has ended. */
export function newestExperienceFirst<T extends { start: string | null; end: string | null }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const current = Number(!b.end) - Number(!a.end);
    if (current) return current;
    // Among current roles, the newest start wins; completed roles use their end date first.
    const recent = (b.end || b.start || "").localeCompare(a.end || a.start || "");
    return recent || (b.start || "").localeCompare(a.start || "");
  });
}

/** Close successive roles across employers at the month before the next role begins. */
export function closeEarlierRoles<T extends { company: string; title: string; start: string | null; end: string | null; autoEnd?: boolean; concurrent?: boolean }>(items: readonly T[]): T[] {
  const ym = (s: string | null): number | null => {
    const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(s || "");
    return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null;
  };
  return items.map(role => {
    if (role.concurrent || (role.end && !role.autoEnd)) return role;
    const start = ym(role.start);
    if (start == null) return role;
    const next = items.map(other => ym(other.start)).filter((month): month is number => month != null && month > start).sort((a,b) => a-b)[0];
    if (next == null) return role.autoEnd ? { ...role, end: null, autoEnd: false } : role;
    const end = next - 1;
    return { ...role, end: `${Math.floor(end / 12)}-${String(end % 12 + 1).padStart(2,"0")}`, autoEnd: true };
  });
}


/** The department gives a generic designation its professional context without duplicating it. */
export function experienceLabel(role:{title:string;department?:string|null}):string{
 const title=role.title.trim(),department=role.department?.trim();
 if(!department)return title;
 const normalized=(s:string)=>s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 return normalized(title).includes(normalized(department))?title:`${title} · ${department}`;
}
/** The name-line follows the latest role, including legacy CVs with an outdated stored headline. */
export function careerHeadline(experience:readonly {title:string;department?:string|null;start:string|null;end:string|null}[]=[],fallback=''):string{
 const role=newestExperienceFirst(experience).find(e=>e.title.trim());
 return role?experienceLabel(role):fallback;
}
