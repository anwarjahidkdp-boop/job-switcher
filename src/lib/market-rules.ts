// Reviewed sources are explicit. All other markets use review-first restrictions;
// a regional CV convention is never treated as a verified employment law.
export const MARKET_ELIGIBILITY_RULES={
 BD:{age:'posted-limit',reviewed:'2026-10-23',sources:['https://alljobs.teletalk.com.bd/','https://bdlaws.minlaw.gov.bd/']},
 GB:{age:'protected',reviewed:'2026-10-23',sources:['https://www.gov.uk/employer-preventing-discrimination/recruitment','https://www.nidirect.gov.uk/articles/age-discrimination']},
 US:{age:'protected',reviewed:'2026-10-23',sources:['https://www.eeoc.gov/age-discrimination','https://www.eeoc.gov/prohibited-employment-policiespractices']},
} as const;
export function agePolicy(country:string):'posted-limit'|'protected'|'review-required'{
 return country==='BD'?MARKET_ELIGIBILITY_RULES.BD.age:country==='GB'?MARKET_ELIGIBILITY_RULES.GB.age:country==='US'?MARKET_ELIGIBILITY_RULES.US.age:'review-required';
}
