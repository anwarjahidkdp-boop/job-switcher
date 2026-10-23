import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}));
import {ManualCvEditor} from './ManualCvEditor';
import {manualDraft} from '@/lib/manual-cv';
import {DEMO_MASTER} from '@/lib/demo';
const input=()=>{const cv=manualDraft(DEMO_MASTER,[]);cv.experience=cv.experience.slice(0,1).map(e=>({...e,title:'Accounts Manager',bullets:['Full Accounts Management']}));return cv;};
it('proactively highlights a vague role before the editor is opened',()=>{
 const html=renderToStaticMarkup(React.createElement(ManualCvEditor,{initial:input(),baseId:'cv',country:'BD',revision:0}));
 expect(html).toContain('Experience details need attention');expect(html).toContain('Accounts Manager');expect(html).toContain('Choose responsibilities to add');
});
it('removes the detail recommendation once concrete responsibilities are saved',()=>{
 const cv=input();cv.experience[0].bullets=['Managed accounting operations.','Reviewed financial reporting and team activities.'];
 const html=renderToStaticMarkup(React.createElement(ManualCvEditor,{initial:cv,baseId:'cv',country:'BD',revision:0}));expect(html).not.toContain('Experience details need attention');
});
