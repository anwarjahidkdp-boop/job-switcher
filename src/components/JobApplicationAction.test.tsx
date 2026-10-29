import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {JobApplicationAction} from './JobApplicationAction';
import type {AppStatus} from '@/lib/types';
it('replaces Apply with the actual submitted status for every completed stage',()=>{
 for(const status of ['applied','interview','offer','closed','withdrawn'] as AppStatus[]){
  const html=renderToStaticMarkup(<JobApplicationAction application={{status,applied_at:'2026-10-24'}}><button>Apply</button></JobApplicationAction>);
  expect(html).not.toContain('<button');expect(html).toContain('View application status:');expect(html).toContain(status==='interview' ? 'href="#interview"' : 'href="/applications"');
 }
});
it('keeps a prepared draft labelled Prepared instead of Apply',()=>{
 const html=renderToStaticMarkup(<JobApplicationAction application={{status:'ready',applied_at:null}}><button>Apply</button></JobApplicationAction>);expect(html).not.toContain('<button>Apply</button>');expect(html).toContain('Prepared');
});
