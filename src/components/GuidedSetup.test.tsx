// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {GuidedSetup} from './GuidedSetup';
import {draftEnvelope,emptySetup,SETUP_DRAFT_KEY} from '@/lib/guided-setup';
vi.mock('./CountrySelect',()=>({CountrySelect:({value,onChange,label,disabled}:{value:string;onChange:(v:string)=>void;label:string;disabled?:boolean})=><select aria-label={label} value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}><option value="BD">Bangladesh</option><option value="GB">United Kingdom</option></select>}));
let host:HTMLDivElement,root:Root;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('requestAnimationFrame',(f:()=>void)=>{f();return 0;});Element.prototype.scrollIntoView=vi.fn();localStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
const button=(text:string)=>{const b=Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.trim()===text);if(!b)throw new Error('Missing button '+text);return b;};
const click=async(text:string)=>{await act(async()=>button(text).click());};
const input=async(selector:string,value:string)=>{const el=host.querySelector(selector) as HTMLInputElement;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));});};
it('restores answers, enforces validation, preserves Back, and completes without repeating saved answers',async()=>{
 const onComplete=vi.fn().mockResolvedValue(undefined);
 const d={...emptySetup('GB'),roles:'Financial Accountant',locations:'London',salaryMin:42000,workAuthorization:'yes' as const,sponsorshipRequired:false,willingToRelocate:false};
 localStorage.setItem(SETUP_DRAFT_KEY,draftEnvelope(d));
 await act(async()=>root.render(<GuidedSetup onComplete={onComplete}/>));
 await click('Continue →');expect(host.textContent).toContain('What jobs');expect(host.querySelector('[aria-label="Remove Financial Accountant"]')).not.toBeNull();
 await click('Continue →');expect(host.textContent).toContain('Where would');await click('Remote');await click('Continue →');
 await input('input[type=number]','0');await click('Continue →');expect((host.querySelector('input[type=number]') as HTMLInputElement).checkValidity()).toBe(false);expect(onComplete).not.toHaveBeenCalled();
 await input('input[type=number]','48000');await click('Continue →');await click('Continue →');expect(host.textContent).toContain('companies');await click('← Back');expect(host.textContent).toContain('Can you work');await click('Continue →');await click('Continue →');await click('Continue →');
 expect(host.textContent).toContain('Does this look right');expect(host.textContent).toContain('48000');expect(host.textContent).not.toContain('Date of birth');
 await click('Next: upload my CV');expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({roles:'Financial Accountant',salaryMin:48000,mode:'Remote',home:'GB'}));
});
it('reviews authenticated answers first, asks only missing fields, and never overwrites billing country in this form',async()=>{
 await act(async()=>root.render(<GuidedSetup authenticated billingLocked initial={{...emptySetup('BD'),roles:'Accountant'}} onComplete={vi.fn()}/>));
 expect(host.textContent).toContain('Does this look right');await click('Save and create my CV');expect(host.querySelector('[role=alert]')).not.toBeNull();
 const edit=host.querySelectorAll('dl button')[0] as HTMLButtonElement;await act(async()=>edit.click());expect((host.querySelector('select') as HTMLSelectElement).disabled).toBe(true);await click('Save answer →');expect(host.textContent).toContain('Does this look right');
});

it('selects multiple suggested titles, adds custom titles and removes independently',async()=>{
 localStorage.setItem(SETUP_DRAFT_KEY,draftEnvelope(emptySetup('GB')));
 await act(async()=>root.render(<GuidedSetup onComplete={vi.fn()}/>));await click('Continue →');
 await click('Accountant');await click('Financial Accountant');expect(host.textContent).toContain('2 job titles selected');
 await input('input','Audit Manager');await click('Add job title');expect(host.textContent).toContain('3 job titles selected');
 await act(async()=>{(host.querySelector('[aria-label="Remove Accountant"]') as HTMLButtonElement).click();});
 await click('Continue →');await click('← Back');expect(host.querySelector('[aria-label="Remove Audit Manager"]')).not.toBeNull();expect(host.querySelector('[aria-label="Remove Financial Accountant"]')).not.toBeNull();expect(host.querySelector('[aria-label="Remove Accountant"]')).toBeNull();
});
