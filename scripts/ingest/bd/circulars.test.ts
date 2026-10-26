import { describe, expect, it } from 'vitest';
import { BD_SOURCES } from './registry';
import { circularImages, circularJobs, cleanOcr, freeCircular, mentions, pageLabels, samePost, type CircularOut } from './circulars';

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
  it('reads image circulars for free when the OCR text confirms the page labels', () => {
    const html = '<nav>Home Jobs</nav><h1>KHULNA UNIVERSITY OF ENGINEERING AND TECHNOLOGY -KUET</h1><p>Position: Lecturer (Civil Engineering)</p><p>Application Deadline: 29 Nov, 2026</p>';
    const labels = pageLabels(html, 'bdjobstoday');
    expect(labels).toEqual({ employer: 'KHULNA UNIVERSITY OF ENGINEERING AND TECHNOLOGY -KUET', title: 'Lecturer (Civil Engineering)' });
    const ocr = 'Khulna University of Engineering & Technology\n~~ |; ¦\nRecruitment of Lecturer in the Department of Civil Engineering\nQualification: B.Sc. in Civil Engineering with first class from a recognised university.\nApply online at https://careers.kuet.ac.bd before the deadline. Contact registrar@kuet.ac.bd for any queries.';
    const free = freeCircular(labels, pageText, ocr)!;
    expect(free.details).not.toMatch(/~~/);
    expect(free.out.jobs[0]).toMatchObject({ title: 'Lecturer (Civil Engineering)', deadline: '2026-11-29', apply_email: 'registrar@kuet.ac.bd', apply_url: 'https://careers.kuet.ac.bd' });
    const r = circularJobs(free.out, { docUrl, pageText, source, today, details: free.details });
    expect(r.jobs).toHaveLength(1);
    expect(r.jobs[0].discovery.evidence).toBe('ocr_extracted');
    expect(r.jobs[0].description).toMatch(/From the circular:\n[\s\S]*first class/);
  });
  it('leaves a circular for AI when the free reading cannot confirm it', () => {
    const labels = { employer: 'Khulna University of Engineering and Technology', title: 'Lecturer (Civil Engineering)' };
    expect(freeCircular(labels, pageText, 'too short')).toBeNull();
    expect(freeCircular(labels, pageText, 'Garments factory needs sewing operators and helpers. Walk-in interview at the Gazipur office every day from 9 am. Bring photocopies of certificates, national ID and two passport photos. Experience of two years preferred for senior posts.')).toBeNull();
    expect(freeCircular({ employer: null, title: 'Lecturer' }, pageText, 'x'.repeat(300))).toBeNull();
    expect(mentions('Recruitment of LECTURER, civil engineering dept', 'Lecturer (Civil Engineering)')).toBe(true);
    expect(cleanOcr('  a  b c \n|| ~ ;;\nok')).toBe('a b c');
  });
});
