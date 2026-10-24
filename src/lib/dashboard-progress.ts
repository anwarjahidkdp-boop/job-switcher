import type { ApplicationRow } from './server/state';
import type { NotificationRow } from './server/notify';
import { isResolvedApplication, submittedApplications } from './applied-history';
import { STATUS_LABEL } from './types';

/** Lifetime stored packs, including submitted packs; never confuse the queue with work completed. */
export function applicationProgressCounts(apps: Record<string, ApplicationRow>) {
  return { prepared: Object.values(apps).filter(a => !!a.pack).length, applied: submittedApplications(apps).length };
}

/** Historical match announcements must not invite a second application after submission. */
export function currentApplicationNotifications(notes: NotificationRow[], apps: Record<string, ApplicationRow>) {
  return notes.map(n => {
    const jobId = n.link?.match(/^\/jobs\/([^/?#]+)(?:[?#].*)?$/)?.[1];
    const a = jobId ? apps[jobId] : undefined;
    if (!a || !isResolvedApplication(a) || !['match', 'ready', 'reminder'].includes(n.kind)) return n;
    const status = ['applied', 'interview', 'offer', 'closed', 'withdrawn'].includes(a.status) ? STATUS_LABEL[a.status] : 'Applied';
    const title = n.title.replace(/^New\s+/i, '');
    return { ...n, title: `${status} · ${title}`, body: a.applied_at || ['applied', 'interview', 'offer'].includes(a.status) ? 'Application already submitted. View its status in Applied.' : 'This opportunity is closed. Review other available jobs.', link: a.applied_at || ['applied', 'interview', 'offer'].includes(a.status) ? '/applications' : '/opportunities' };
  });
}
