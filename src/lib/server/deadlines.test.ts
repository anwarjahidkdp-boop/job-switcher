import {beforeEach,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
vi.mock('./state',()=>({loadState:vi.fn()}));
vi.mock('./notify',()=>({notify:vi.fn().mockResolvedValue(1)}));
vi.mock('../email/send',()=>({emailProvider:()=>true}));
vi.mock('./email-outbox',()=>({deliverEmail:vi.fn().mockResolvedValue('sent')}));
import {loadState} from './state';
import {notify} from './notify';
import {deliverEmail} from './email-outbox';
import {sendDeadlineAlerts} from './deadlines';
const now=new Date('2026-10-24T06:00:00Z');
function setup(email=true){vi.mocked(loadState).mockResolvedValue({P:{salaryMin:null,workAuthorization:'yes'},country:'BD',today:'2026-10-24',profile:{onboarding_step:'done',email_reminders:email,email:'owner@example.invalid',full_name:'Test',preferences:null,deal_breakers:{},answer_library:{},needs_visa:false},dismissed:new Set(),apps:{},scored:[{job:{id:'j',country:'BD',active:true,title:'Role',company:'Employer',deadline:'2026-10-27',minYears:0},m:{score:79,relevant:true,expired:false}}]} as never);}
beforeEach(()=>vi.clearAllMocks());
it('uses stable notification and daily digest keys so repeated scheduling cannot duplicate delivery',async()=>{
 setup();const db={} as SupabaseClient;await sendDeadlineAlerts(db,{appUrl:'https://jobpao.app',now,userIds:['u']});await sendDeadlineAlerts(db,{appUrl:'https://jobpao.app',now,userIds:['u']});
 expect(vi.mocked(notify).mock.calls[0][2][0].key).toBe(vi.mocked(notify).mock.calls[1][2][0].key);
 expect(vi.mocked(deliverEmail).mock.calls[0][2]).toBe(vi.mocked(deliverEmail).mock.calls[1][2]);
 expect(vi.mocked(deliverEmail).mock.calls[0][3]).toMatchObject({deadlineContext:{country:'BD',date:'2026-10-24',jobIds:['j']}});
});
it('keeps in-app alerts when email is opted out and spends no AI',async()=>{
 setup(false);const result=await sendDeadlineAlerts({} as SupabaseClient,{appUrl:'https://jobpao.app',now,userIds:['u']});expect(result.notified).toBe(1);expect(deliverEmail).not.toHaveBeenCalled();
});
it('supports read-only dry runs without notifications or email delivery',async()=>{
 setup();expect((await sendDeadlineAlerts({} as SupabaseClient,{appUrl:'https://jobpao.app',now,userIds:['u'],dryRun:true})).notified).toBe(1);expect(notify).not.toHaveBeenCalled();expect(deliverEmail).not.toHaveBeenCalled();
});
