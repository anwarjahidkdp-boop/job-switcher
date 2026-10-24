import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}));
import {ApplicationProgress} from './ApplicationProgress';
it('offers explicit self-reporting after preparing documents, without claiming automatic email verification',()=>{
 const html=renderToStaticMarkup(<ApplicationProgress jobId="j" status="ready" appliedAt={null} history={[]} trial remaining={1}/>);
 expect(html).toContain('I’ve applied');expect(html).toContain('cannot verify emails');expect(html).toContain('daily application allowance');
});
it('shows interview and offer controls after an application is recorded',()=>{
 const html=renderToStaticMarkup(<ApplicationProgress jobId="j" status="applied" appliedAt="2026-10-24" history={[{status:'applied',event:'You confirmed: applied externally'}]} trial remaining={0}/>);
 expect(html).toContain('confirmed by you');expect(html).toContain('Add interview details');expect(html).toContain('Offer received');expect(html).toContain('View Applied');
});
