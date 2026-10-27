import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('@/app/actions', () => ({ addSkillAction: vi.fn(), appliedAction: vi.fn(), dismissAction: vi.fn(), openedAction: vi.fn(), snoozeAction: vi.fn() }));
import { UKApplicationAnswers, UKApplicationJourney, UKApplicationStep } from './UKApplicationJourney';
import { ApplicationProgress } from './ApplicationProgress';
import { PackTabs, ActionsPanel } from '@/app/(app)/jobs/[id]/client';
import { ukApplicationAnswers } from '@/lib/uk-application';

it('shows four steps and keeps portal jobs free of an email draft', () => {
  const html = renderToStaticMarkup(<UKApplicationJourney prepared opened={false} submitted={false} route={{kind:'portal',label:'Continue on Reed',href:'https://www.reed.co.uk/jobs/1',recipient:null}}><PackTabs showEmail={false} jobId="job" updatedAt="v" cv={<p>CV</p>} cvEditor={<p>Editor</p>} cover="Letter" subject="Subject" email="Email" to={null} checklist={['CV']}/></UKApplicationJourney>);
  for (const label of ['Prepare', 'Review', 'Submit', 'Track']) expect(html).toContain(label);
  expect(html).not.toContain('View email draft');
  expect(html).toContain('Review document checklist');
});
it('lets a waiting portal application reopen the website without treating it as submitted', () => {
  const html = renderToStaticMarkup(<ActionsPanel journey jobId="job" status="waiting" hasPack reminderDate={null} appliedAt={null} deadline={null} today="2026-10-27" applyMethod="portal" applyTarget={null} url="https://careers.example.com/job" notYet={false} gmailReady={false} gmail={null} gmailStatus={null}/>);
  expect(html).toContain('https://careers.example.com/job');
  expect(html).not.toContain('Yes, Applied');
});
it('distinguishes user confirmation and Gmail acceptance and preserves the existing default UI', () => {
  const props = {jobId:'job',status:'applied' as const,appliedAt:'2026-10-27',trial:false,remaining:1};
  expect(renderToStaticMarkup(<ApplicationProgress {...props} journey history={[{status:'applied',event:'You confirmed: applied externally'}]}/>)).toContain('Submitted · confirmed by you');
  expect(renderToStaticMarkup(<ApplicationProgress {...props} journey history={[{status:'applied',event:'Sent from user to employer (Gmail message id)'}]}/>)).toContain('Email sent · Gmail accepted');
  const old = renderToStaticMarkup(<ApplicationProgress {...props} history={[]}/>);
  expect(old).toContain('Track your application');expect(old).not.toContain('Opened');
});

// Opt-in screenshot fixtures render the actual components with fictional data; no app endpoints run.
it('renders the workspace with missing and saved answers', async () => {
  const answers = ukApplicationAnswers({workAuthorization:'yes',workAuthorizationSource:'user',sponsorshipRequired:false,sponsorshipSource:'user',expectedSalary:42000,salaryCountry:'GB',noticeDays:30},null);
  const html = renderToStaticMarkup(<UKApplicationJourney prepared opened={false} submitted={false} route={{kind:'portal',label:'Continue to employer website',href:'https://careers.example.com/job',recipient:null}}>
    <UKApplicationStep id="application" number={1} title="Your application documents" sub="Prepared for Finance Analyst at Example Company · London">
      <PackTabs showEmail={false} jobId="preview" updatedAt="preview" cv={<p>Example CV</p>} cvEditor={<p>Example editor</p>} cover="Example letter" subject="Subject" email="Example email" to={null} checklist={['CV','Cover letter']}/>
    </UKApplicationStep>
    <UKApplicationStep id="uk-review" number={2} title="Review your answers" sub="Saved information, ready to copy into the employer’s form."><UKApplicationAnswers answers={answers}/></UKApplicationStep>
    <UKApplicationStep id="uk-submit" number={3} title="Continue to the application" sub="Keep your reviewed documents ready. Submit on the original site."><ActionsPanel journey jobId="preview" status="ready" hasPack reminderDate={null} appliedAt={null} deadline={null} today="2026-10-27" applyMethod="portal" applyTarget={null} url="https://careers.example.com/job" notYet={false} gmailReady={false} gmail={null} gmailStatus={null}/></UKApplicationStep>
    <UKApplicationStep id="uk-track" number={4} title="Confirm & track" sub="Only record a submission after you have actually sent it."><ApplicationProgress jobId="preview" status="ready" appliedAt={null} history={[]} trial={false} remaining={1} journey/></UKApplicationStep>
  </UKApplicationJourney>);
  expect(html).toContain('£42,000 per year');expect(html).toContain('I submitted this application');
  if (process.env.UK_SCREENSHOT_DIR) {
    const fs = await import('node:fs/promises');const css = await fs.readFile('src/components/UKApplicationJourney.module.css','utf8');
    const styles = (await import('./UKApplicationJourney.module.css')).default;
    const scoped = css.replace(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g,(all,key)=>styles[key]?'.'+styles[key]:all);
    const global = await fs.readFile('src/app/globals.css','utf8');
    await fs.mkdir(process.env.UK_SCREENSHOT_DIR,{recursive:true});
    for (const [name,width] of [['desktop',1000],['mobile',390]] as const) {
      await fs.writeFile(`${process.env.UK_SCREENSHOT_DIR}/uk-application-${name}.html`,`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${global}\n${scoped}\nbody{margin:0;background:#f4f6fa;font-family:Arial,sans-serif}.preview-shell{width:min(100% - 32px,${width}px);margin:28px auto}.preview-label{font-size:11px;color:#66758c;margin:0 0 10px}.preview-shell .journey{margin:0}</style></head><body><main class="preview-shell"><p class="preview-label">JOBPAO · IMPLEMENTATION PREVIEW · FICTIONAL PROFILE</p>${html}</main></body></html>`);
    }
  }
});
