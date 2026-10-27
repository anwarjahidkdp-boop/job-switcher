// Reviewed sources are explicit. All other markets use review-first restrictions;
// a regional CV convention is never treated as a verified employment law.
export const MARKET_ELIGIBILITY_RULES={
 BD:{age:'posted-limit',reviewed:'2026-10-23',sources:['https://alljobs.teletalk.com.bd/','https://bdlaws.minlaw.gov.bd/']},
 GB:{age:'protected',reviewed:'2026-10-23',sources:['https://www.gov.uk/employer-preventing-discrimination/recruitment','https://www.nidirect.gov.uk/articles/age-discrimination']},
 US:{age:'protected',reviewed:'2026-10-23',sources:['https://www.eeoc.gov/age-discrimination','https://www.eeoc.gov/prohibited-employment-policiespractices']},
} as const;
/** Bangladesh government jobs: the upper entry age for direct recruitment in government, autonomous and statutory bodies and
 *  public corporations, set to 32 by the 2024 ordinance (amended Dec 2025: higher limits in a post's own recruitment rules stay)
 *  and passed into law on 5 April 2026. A circular's own posted limit always wins; this applies only when it states none. */
export const BD_GOV_AGE={maxAge:32,/** Entry grades the default applies to; upper grades (1-8) and senior titles are experienced hires, so the default is never assumed (owner 2026-10-27). */entryGrades:[9,20] as const,reviewed:'2026-10-27',sources:['https://en.prothomalo.com/bangladesh/parliament/nevt3lxj8b','https://en.prothomalo.com/youth/employment/pziknuquul']};
export function agePolicy(country:string):'posted-limit'|'protected'|'review-required'{
 return country==='BD'?MARKET_ELIGIBILITY_RULES.BD.age:country==='GB'?MARKET_ELIGIBILITY_RULES.GB.age:country==='US'?MARKET_ELIGIBILITY_RULES.US.age:'review-required';
}
