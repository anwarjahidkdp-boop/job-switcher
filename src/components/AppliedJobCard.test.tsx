import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {AppliedJobCard} from './AppliedJobCard';
import type {ApplicationRow} from '@/lib/server/state';
import type {Job} from '@/lib/types';
it('keeps the submitted job and its actual interview/offer status in a single card',()=>{
 const app={status:'offer',applied_at:'2026-10-23T00:00:00Z',interview_at:null,application_events:[]} as unknown as ApplicationRow;
 const job={id:'job',title:'Accounts Manager',company:'Example Employer',country:'BD',location:'Dhaka'} as Job;
 const html=renderToStaticMarkup(<AppliedJobCard application={app} job={job}/>);
 expect(html).toContain('Accounts Manager');expect(html).toContain('Example Employer');expect(html).toContain('Applied on');expect(html).toContain('Job offer');expect(html).toContain('Received');expect(html).toContain('Not recorded yet');expect(html).not.toContain('Jobs analysed');expect(html).not.toContain('Good Fit or better');expect(html).not.toContain('timeline');
});
