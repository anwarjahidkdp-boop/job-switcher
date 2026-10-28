// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {LoginForm} from './LoginForm';
const {signUp,replace}=vi.hoisted(()=>({signUp:vi.fn(),replace:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({replace,refresh:vi.fn(),push:vi.fn()})}));
vi.mock('@/lib/supabase/browser',()=>({createClient:()=>({auth:{signUp}})}));
vi.mock('@/components/AuthCaptcha',()=>({AuthCaptcha:()=>null}));
let host:HTMLDivElement,root:Root;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);signUp.mockReset();replace.mockReset();host=document.createElement('div');document.body.append(host);root=createRoot(host);localStorage.setItem('jp_guided_setup_v1','saved answers');});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
async function submit(result:unknown){signUp.mockResolvedValue(result);await act(async()=>root.render(<LoginForm initial="signup" next="/onboarding?import=1"/>));for(const [id,value] of [['email','existing@example.com'],['password','Password123']]){await act(async()=>{const el=host.querySelector('#'+id)!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));});}await act(async()=>host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));}
it.each([
 {data:{user:{identities:[]},session:null},error:null},
 {data:{user:null,session:null},error:{code:'user_already_exists',message:'User already registered'}}
])('directs existing users to login without claiming an email was sent',async(result)=>{await submit(result);expect(host.textContent).toContain('An account with this email already exists');expect(host.textContent).toContain('Forgot password?');expect((host.querySelector('#email') as HTMLInputElement).value).toBe('existing@example.com');expect((host.querySelector('#password') as HTMLInputElement).value).toBe('');expect(host.textContent).not.toContain('We sent a link');expect(replace).not.toHaveBeenCalled();expect(localStorage.getItem('jp_guided_setup_v1')).toBe('saved answers');});
it('keeps confirmation guidance for a new signup',async()=>{await submit({data:{user:{identities:[{id:'new'}]},session:null},error:null});expect(host.textContent).toContain('Check your inbox');expect(host.textContent).toContain('Already have an account');expect(host.textContent).not.toContain('An account with this email already exists');});
