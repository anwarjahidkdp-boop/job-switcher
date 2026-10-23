/** Optional examples, confirmed by the user before inclusion. No AI call or invented achievements. */
const CATALOG: [RegExp, string[]][] = [
  [/\bcost\s+account/, ["Prepared cost reports and analysed production expenditure.", "Reviewed inventory costs and investigated cost variances.", "Supported budgeting and cost control activities.", "Reconciled cost records with financial accounts."]],
  [/\b(accounts|accounting|finance|financial)\b.*\b(manager|head|lead|controller)\b|\b(manager|head|lead)\b.*\b(accounts|accounting|finance)\b/i, ["Managed day-to-day accounting operations.", "Prepared monthly financial and management reports.", "Monitored team activities and coordinated daily accounting work.", "Prepared budgets and monitored expenditure.", "Reviewed bank reconciliations and general ledger records.", "Coordinated month-end closing and financial reporting."]],
  [/\b(accountant|accounts|accounting|bookkeeper|finance)\b/, ["Recorded daily financial transactions and maintained accounting records.", "Prepared bank reconciliations and reviewed ledger balances.", "Processed invoices and maintained payable and receivable records.", "Supported month-end closing and financial reporting."]],
  [/\b(human resources|hr|recruiter|recruitment)\b/, ["Coordinated recruitment and employee onboarding activities.", "Maintained employee records and HR documentation.", "Supported attendance tracking and payroll administration.", "Responded to employee queries and coordinated HR processes."]],
  [/\b(software|developer|programmer)\b/, ["Developed and maintained software features according to requirements.", "Tested changes and resolved reported defects.", "Reviewed code and collaborated with the development team.", "Maintained technical documentation for implemented features."]],
  [/\b(sales|business development|account manager)\b/, ["Identified customer requirements and presented relevant products or services.", "Prepared proposals and followed up on sales enquiries.", "Maintained customer relationships and sales records.", "Coordinated with internal teams to fulfil customer requirements."]],
  [/\b(marketing|brand|seo|content)\b/, ["Planned and coordinated marketing activities.", "Prepared content for relevant marketing channels.", "Reviewed campaign performance and prepared reports.", "Coordinated marketing materials with internal teams."]],
  [/\b(admin|administration|operations|office)\b/, ["Coordinated daily office operations and administrative tasks.", "Maintained records, schedules and operational documentation.", "Liaised with colleagues and suppliers on operational requirements.", "Prepared routine reports and followed up on assigned activities."]],
  [/\b(teacher|lecturer|trainer|instructor)\b/, ["Prepared teaching materials and delivered lessons.", "Assessed learner progress and provided feedback.", "Maintained attendance and assessment records.", "Adapted learning activities to students’ requirements."]],
];
export function roleSuggestions(title: string, existing: string[]): string[] {
  const key = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const used = new Set(existing.map(key));
  return (CATALOG.find(([pattern]) => pattern.test(title.toLowerCase()))?.[1] || []).filter(s => !used.has(key(s)));
}

/** Brief placeholders such as "Full accounts management" still need concrete responsibilities. */
export function experienceNeedsDetails(role:{bullets:string[]}):boolean{
 const lines=role.bullets.map(s=>s.trim()).filter(Boolean);
 return !lines.length || (lines.length<2 && lines.join(" ").length<80);
}
