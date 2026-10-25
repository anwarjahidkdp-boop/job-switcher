import { describe, expect, it } from 'vitest';
import { BD_SOURCES } from './registry';
import { circularImages, circularJobs, samePost, type CircularOut } from './circulars';

const source = BD_SOURCES.find(s => s.key === 'bdjobstoday')!;
const docUrl = 'https://www.bdjobstoday.com/hotjobs_details.php?id=293227';
const today = '2026-10-25';
const pageText = 'KHULNA UNIVERSITY OF ENGINEERING AND TECHNOLOGY -KUET\nPosition: Lecturer (Civil Engineering)\nApplication Deadline: 29 Nov, 2026\nPublished On: 20 Oct, 2026';
const job = (over: Partial<CircularOut['jobs'][number]> = {}) => ({ title: 'Lecturer (Civil Engineering)', location: 'Khulna', vacancies: 2, deadline: '2026-11-29', education: 'B.Sc. in Civil Engineering', experience: null, age_limit: null, salary: 'Grade 9', requirements: ['First class in B.Sc.'], responsibilities: [], apply_email: null, apply_url: 'https://careers.kuet.ac.bd', how_to_apply: 'Apply online', ...over });
const out = (jobs = [job()], employer: string | null = 'Khulna University of Engineering and Technology'): CircularOut => ({ is_recruitment_circular: true, employer, jobs });

describe('held circular reading', () => {
  it('publishes the vacancy the listing page names, with the page deadline and a traceable source', () => {
    const r = circularJobs(out([job(), job({ title: 'Assistant Registrar' })]), { docUrl, pageText, source, today });
    expect(r.reason).toBeNull();
    expect(r.jobs).toHaveLength(1);
    expect(r.jobs[0]).toMatchObject({ title: 'Lecturer (Civil Engineering)', company: 'Khulna University of Engineering and Technology', deadline: '2026-11-29', country: 'BD', url: docUrl, apply: { method: 'portal', target: 'https://careers.kuet.ac.bd/' }, discovery: { evidence: 'ai_extracted' } });
    expect(r.jobs[0].description).toMatch(/Confirm all details in the original circular/);
  });
  it('keeps uncertain circulars in review', () => {
    expect(circularJobs(out([job()], null), { docUrl, pageText, source, today }).jobs).toEqual([]);
    expect(circularJobs(out([job()], 'A reputed company'), { docUrl, pageText, source, today }).jobs).toEqual([]);
    expect(circularJobs(out([job({ deadline: '2026-11-30' })]), { docUrl, pageText, source, today }).reason).toMatch(/deadlines disagree/);
    expect(circularJobs(out([job({ title: 'Driver' })]), { docUrl, pageText, source, today }).jobs).toEqual([]);
    const noLabels = { docUrl, pageText: 'Circular', source, today };
    expect(circularJobs(out([job({ deadline: '2026-10-01' })]), noLabels).reason).toMatch(/no current deadline/);
    expect(circularJobs(out([job({ deadline: null })]), noLabels).jobs).toEqual([]);
    expect(circularJobs({ is_recruitment_circular: false, employer: null, jobs: [] }, noLabels).reason).toMatch(/No current vacancy/);
  });
  it('never publishes a circular that asks applicants for money', () => {
    const r = circularJobs(out([job({ how_to_apply: 'Pay a registration fee of Tk 3,000 by bKash before the interview.' })]), { docUrl, pageText, source, today });
    expect(r.jobs).toEqual([]);
    expect(r.reason).toMatch(/fake job/);
  });
  it('uses an email route only when a valid address is printed', () => {
    const r = circularJobs(out([job({ apply_email: 'hr@kuet.ac.bd', apply_url: null })]), { docUrl, pageText, source, today });
    expect(r.jobs[0].apply).toEqual({ method: 'email', target: 'hr@kuet.ac.bd' });
  });
  it('finds the circular image on the page and skips logos and site banners', () => {
    const html = '<img src="/resource/6pix.jpg"><img src="https://www.bdjobstoday.com/adsimages/jobs86678a.jpg"><img src="/images/logo.png"><img src="https://cdn.other.com/x.jpg"><img src="/images/notice.jpg">';
    expect(circularImages(html, docUrl)).toEqual(['https://www.bdjobstoday.com/adsimages/jobs86678a.jpg']);
  });
  it('matches post names ignoring case and punctuation', () => {
    expect(samePost('Lecturer (Civil Engineering)', 'lecturer civil engineering')).toBe(true);
    expect(samePost('Engineer (CSE)', 'Senior Engineer')).toBe(false);
  });
});
