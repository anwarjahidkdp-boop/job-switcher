-- Atomic, user-scoped manual save. No AI usage, subscription allowance or external service is involved.
create or replace function public.save_manual_cv(p_base_id uuid,p_country text,p_revision integer,p_content jsonb,p_facts jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare u uuid := auth.uid(); old public.master_cvs%rowtype; m uuid;
begin
 if u is null then raise exception 'Please sign in again.' using errcode='42501'; end if;
 perform 1 from public.profiles where id=u and target_country=p_country and search_country_version=p_revision for update;
 if not found then raise exception 'Your job-search country changed. Reload before saving your CV.' using errcode='P0001'; end if;
 select * into old from public.master_cvs where user_id=u and is_current for update;
 if not found or old.id<>p_base_id then raise exception 'Your CV changed in another tab. Reload before saving again.' using errcode='P0001'; end if;
 if old.source_cv_document_id is not null and not exists(select 1 from public.cv_documents where id=old.source_cv_document_id and user_id=u and is_current) then
   raise exception 'You uploaded a new CV. Reload before editing it.' using errcode='P0001';
 end if;
 if p_content is null or jsonb_typeof(p_content)<>'object' or coalesce(p_content->>'name','')='' or p_facts is null or jsonb_typeof(p_facts)<>'array' or jsonb_array_length(p_facts)>400 or octet_length(p_content::text)>200000 then
   raise exception 'Invalid CV data.' using errcode='P0001';
 end if;
 if exists(select 1 from jsonb_array_elements(p_facts) f where coalesce(f->>'kind','') not in ('experience','education','certification','skill','language') or coalesce(jsonb_typeof(f->'data'),'')<>'object') then
   raise exception 'Invalid career information.' using errcode='P0001';
 end if;
 -- A failure below rolls back both the profile facts and the new master version.
 delete from public.career_facts where user_id=u and kind<>'answer';
 insert into public.career_facts(user_id,cv_document_id,kind,data,provenance,verified)
 select u,old.source_cv_document_id,f.kind,f.data,'user',true
 from jsonb_to_recordset(p_facts) as f(kind text,data jsonb);
 if exists(select 1 from public.career_facts where user_id=u and kind<>'answer' and (kind not in ('experience','education','certification','skill','language') or jsonb_typeof(data)<>'object')) then
   raise exception 'Invalid career information.' using errcode='P0001';
 end if;
 m := public.replace_master_cv(p_content,'{}',false,null,old.source_cv_document_id);
 update public.profiles set full_name=p_content->>'name',career_meta=(career_meta-'edits'-'removed') || jsonb_build_object('manual_cv',true,'edits',jsonb_build_array('Use the manually saved CV as the authoritative career information: ' || p_content::text),'removed','[]'::jsonb) where id=u;
 return m;
end $$;
revoke all on function public.save_manual_cv(uuid,text,integer,jsonb,jsonb) from public,anon;
grant execute on function public.save_manual_cv(uuid,text,integer,jsonb,jsonb) to authenticated;
