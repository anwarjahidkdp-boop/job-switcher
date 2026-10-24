import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {FitReasons} from './FitReasons';
import type {Scored} from '@/lib/matching';
it('labels numbers as job counts, keeps explanations visible and collapses linked examples',()=>{
 const rows=Array.from({length:25},(_,i)=>({job:{id:'job-'+i,title:'Accounts Officer',company:'Example'},m:{score:54,relevant:true,expired:false,reason:'Seniority mismatch',reasonDetail:'',gaps:[]}} as unknown as Scored));
 const html=renderToStaticMarkup(<FitReasons rows={rows}/>);
 expect(html).toContain('25 jobs');expect(html).toContain('below 70%');expect(html).toContain('not missed applications or employer rejections');expect(html).toContain('<details>');expect(html).not.toContain('<details open');expect(html).toContain('href="/jobs/job-0"');expect(html).toContain('54% match');expect(html).not.toContain('Why opportunities were missed');
});
