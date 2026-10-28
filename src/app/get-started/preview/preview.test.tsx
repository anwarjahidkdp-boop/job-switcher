// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {CvPreview} from './preview';
import {draftEnvelope,emptySetup,SETUP_DRAFT_KEY} from '@/lib/guided-setup';
const m=vi.hoisted(()=>({read:vi.fn(),save:vi.fn(),parse:vi.fn(),fetch:vi.fn()}));
vi.mock('@/lib/cv/setup-draft',()=>({readSetupCv:m.read,saveSetupCv:m.save}));
vi.mock('@/lib/cv/browser-read',()=>({readCvFile:m.parse}));
let host:HTMLDivElement,root:Root;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('fetch',m.fetch);vi.clearAllMocks();m.read.mockResolvedValue(null);m.save.mockResolvedValue(undefined);m.parse.mockResolvedValue({kind:'txt',text:'Excel accountant experience '.repeat(12)});localStorage.setItem(SETUP_DRAFT_KEY,draftEnvelope({...emptySetup('GB'),roles:'Accountant',salaryMin:35000,workAuthorization:'yes',sponsorshipRequired:false,willingToRelocate:true}));host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
async function upload(){await act(async()=>root.render(<CvPreview/>));await act(async()=>{const el=host.querySelector('input')!;Object.defineProperty(el,'files',{configurable:true,value:[new File(['CV'],'cv.txt')]});el.dispatchEvent(new Event('change',{bubbles:true}));});}
it('shows only the actual response count, inspected listings and measured time, gating downloads behind signup',async()=>{m.fetch.mockResolvedValue({ok:true,json:async()=>({count:2,searched:124,limited:false,matches:[{title:'Accountant',company:'Example',location:'London',evidence:['excel']}],checkedAt:'2026-10-28'})});await upload();expect(host.textContent).toContain('2 initial job matches found');expect(host.textContent).toMatch(/Checked 124 live listings in \d+\.\d seconds/);expect(host.textContent).toContain('Example');expect(host.querySelector('a[href*="/api/cv/download"]')).toBeNull();expect(host.querySelector('a[href*="mode=signup"]')).not.toBeNull();expect(m.save).toHaveBeenLastCalledWith(expect.objectContaining({file:expect.any(File),text:expect.any(String)}));});
it('shows a failed check as an error, never as a successful match count',async()=>{m.fetch.mockResolvedValue({ok:false,json:async()=>({error:'Please retry'})});await upload();expect(host.querySelector('[role=alert]')?.textContent).toBe('Please retry');expect(host.textContent).not.toContain('matches found');expect(host.textContent).toContain('Check my matches again');});
it('explains unreadable scans without claiming a match or making a request',async()=>{m.parse.mockResolvedValue({kind:'scan',pages:[]});await upload();expect(host.textContent).toContain('This CV is a scan or photo');expect(m.fetch).not.toHaveBeenCalled();expect(host.textContent).toContain('Skip CV for now');});
