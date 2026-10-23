import type { IngestedJob } from '../../../src/lib/ingest/ats';
import type { BangladeshSource } from './registry';

/** Owner approval admits a provider, not every advertisement it carries. */
export function sourceReviewReason(job: IngestedJob, source: BangladeshSource, today: string): string | null {
  if (source.trust !== 'owner_reviewed') return null;
  if (!job.title?.trim() || !job.company?.trim() || /^(?:company not stated|unknown|confidential|anonymous|a reputed company|a renowned company)$/i.test(job.company.trim())) return 'A named position and identifiable employer are required';
  if (!job.deadline || !/^\d{4}-\d{2}-\d{2}$/.test(job.deadline) || job.deadline < today) return 'An explicit current application deadline is required';
  try {
    const u = new URL(job.url || '');
    if (u.protocol !== 'https:' || u.username || u.password || u.hostname.replace(/^www\./, '') !== new URL(source.url).hostname.replace(/^www\./, '')) return 'A traceable original listing on the approved source is required';
  } catch { return 'A traceable original listing on the approved source is required'; }
  if (job.apply.method === 'portal') {
    try { const u = new URL(job.apply.target || ''); if (!/^https?:$/.test(u.protocol) || u.username || u.password) return 'A valid application route is required'; }
    catch { return 'A valid application route is required'; }
  } else if (job.apply.method !== 'email' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(job.apply.target || '')) return 'A valid application route is required';
  return null;
}
