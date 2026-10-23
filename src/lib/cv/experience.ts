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
