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

/** Never invent an end date: concurrent jobs and promotions require explicit dates. */
export function closeEarlierRoles<T extends { company: string; title: string; start: string | null; end: string | null; autoEnd?: boolean; concurrent?: boolean }>(items: readonly T[]): T[] {
  return items.map(role => role.autoEnd ? { ...role, end: null, autoEnd: false } : { ...role });
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
