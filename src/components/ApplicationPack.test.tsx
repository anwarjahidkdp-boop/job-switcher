import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}));
vi.mock('@/app/actions',()=>({addSkillAction:vi.fn(),appliedAction:vi.fn(),dismissAction:vi.fn(),openedAction:vi.fn(),snoozeAction:vi.fn()}));
import {PackTabs} from '@/app/(app)/jobs/[id]/client';
it('shows View, Edit and Download for both documents without expanding either document',()=>{
 const html=renderToStaticMarkup(<PackTabs cv={<p>FULL_CV_CONTENT</p>} cvEditor={<p>FULL_EDITOR_FIELDS</p>} updatedAt="version" jobId="job" cover="FULL_LETTER_CONTENT" subject="Subject" email="Email" to={null} checklist={[]}/>);
 expect(html).toContain('CV document actions');expect(html).toContain('Cover letter document actions');
 for(const action of ['View','Edit','Download'])expect(html.match(new RegExp(`>${action}</button>`,'g'))).toHaveLength(2);
 for(const hidden of ['FULL_CV_CONTENT','FULL_EDITOR_FIELDS','FULL_LETTER_CONTENT'])expect(html).not.toContain(hidden);
});
