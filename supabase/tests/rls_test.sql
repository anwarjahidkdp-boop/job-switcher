\set ON_ERROR_STOP 0
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111','a@x.com'),('22222222-2222-2222-2222-222222222222','b@x.com');
select 'trial created' as t, plan_code, status, (trial_ends_at - trial_started_at) as len from subscriptions where user_id='11111111-1111-1111-1111-111111111111';
insert into jobs (source_kind, source_label, country, title, company) values ('jsonld','Careers','BD','Public Job','Acme');
-- as user A
set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false), set_config('request.jwt.claim.role','authenticated',false);
select 'A sees profiles' as t, count(*) from profiles;
select 'A sees public jobs' as t, count(*) from jobs;
insert into jobs (owner_id, source_kind, source_label, country, title, company) values ('11111111-1111-1111-1111-111111111111','paste','Pasted by you','BD','My Paste','Co') returning 'paste ok' as t;
insert into jobs (owner_id, source_kind, source_label, country, title, company) values (null,'jsonld','x','BD','Fake public','Co');
insert into jobs (owner_id, source_kind, source_label, country, title, company) values ('22222222-2222-2222-2222-222222222222','paste','x','BD','For B','Co');
insert into applications (user_id, job_id) select '11111111-1111-1111-1111-111111111111', id from jobs where title='Public Job' returning 'app ok' as t, status;
update applications set status='applied' where user_id='11111111-1111-1111-1111-111111111111' returning 'applied by user ok' as t, status, applied_at is not null as has_applied_at;
insert into application_events (application_id, user_id, event, actor) select id, user_id, 'sneaky','system' from applications;
insert into application_events (application_id, user_id, event, actor) select id, user_id, 'You confirmed: applied','user' from applications returning 'event ok' as t;
select 'budget' as t, * from ai_budget();
select 'budget of B (should be empty)' as t, count(*) from ai_budget('22222222-2222-2222-2222-222222222222');
select 'alias' as t, alias from ensure_forwarding_address('Md. Rahim');
select 'alias idempotent' as t, alias from ensure_forwarding_address('Other');
insert into forwarding_addresses (user_id, alias) values ('11111111-1111-1111-1111-111111111111','stolen-alias');
insert into ai_usage (user_id, feature, provider, model, cost_micro_usd) values ('11111111-1111-1111-1111-111111111111','x','x','x',0);
update subscriptions set plan_code='pro' where user_id='11111111-1111-1111-1111-111111111111' returning 'SHOULD NOT UPDATE' as t;
insert into storage.objects (bucket_id, name) values ('cv-files','11111111-1111-1111-1111-111111111111/cv/a.pdf') returning 'own storage ok' as t;
insert into storage.objects (bucket_id, name) values ('cv-files','22222222-2222-2222-2222-222222222222/cv/a.pdf');
-- as user B
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select 'B sees A apps' as t, count(*) from applications;
select 'B sees A paste' as t, count(*) from jobs where title='My Paste';
select 'B sees A storage' as t, count(*) from storage.objects;
-- as service role: cannot mark applied
reset role; select set_config('request.jwt.claim.sub','',false), set_config('request.jwt.claim.role','service_role',false);
set role service_role;
update applications set status='waiting'; update applications set status='applied';
insert into applications (user_id, job_id, status) select '22222222-2222-2222-2222-222222222222', id, 'applied' from jobs where title='Public Job';
select 'service budget for A' as t, spent_micro_usd, cap_micro_usd from ai_budget('11111111-1111-1111-1111-111111111111');
reset role;
-- cascade delete
delete from auth.users where id='11111111-1111-1111-1111-111111111111';
select 'after delete A rows' as t, (select count(*) from profiles where id='11111111-1111-1111-1111-111111111111') p, (select count(*) from applications) a, (select count(*) from jobs where title='My Paste') j;
