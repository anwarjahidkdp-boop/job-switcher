-- User-scoped invoker function: preserve RLS and column grants, with one rollback boundary.
create or replace function public.replace_cv(p_document jsonb,p_facts jsonb,p_profile jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare u uuid := auth.uid(); d uuid;
begin
  if u is null then raise exception 'not signed in' using errcode='42501'; end if;
  -- Serialize CV replacements for the same user; another account cannot acquire its row.
  perform 1 from public.profiles where id=u for update;
  if not found then raise exception 'profile missing'; end if;
  update public.cv_documents set is_current=false where user_id=u and is_current;
  insert into public.cv_documents(user_id,storage_path,file_name,mime_type,size_bytes,text_content,text_source,extraction,questions,is_demo,answers)
  values(u,p_document->>'storage_path',p_document->>'file_name',p_document->>'mime_type',(p_document->>'size_bytes')::int,
    p_document->>'text_content',p_document->>'text_source',p_document->'extraction',p_document->'questions',
    coalesce((p_document->>'is_demo')::boolean,false),coalesce(p_document->'answers','{}'::jsonb)) returning id into d;
  delete from public.career_facts where user_id=u and provenance in ('cv','answer');
  insert into public.career_facts(user_id,cv_document_id,kind,data,provenance,verified,evidence)
  select u,d,f.kind,f.data,f.provenance,f.verified,f.evidence
  from jsonb_to_recordset(p_facts) as f(kind text,data jsonb,provenance text,verified boolean,evidence text);
  update public.profiles set full_name=p_profile->>'full_name',phone=p_profile->>'phone',city=p_profile->>'city',
    career_meta=p_profile->'career_meta',onboarding_step='questions' where id=u;
  return d;
end $$;
revoke all on function public.replace_cv(jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.replace_cv(jsonb,jsonb,jsonb) to authenticated;

create or replace function public.replace_master_cv(p_content jsonb,p_flags text[],p_ai boolean,p_model text,p_document_id uuid) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare u uuid := auth.uid(); v int; m uuid;
begin
 if u is null then raise exception 'not signed in' using errcode='42501'; end if;
 perform 1 from public.profiles where id=u for update;
 if not found then raise exception 'profile missing'; end if;
 if p_document_id is not null and not exists(select 1 from public.cv_documents where id=p_document_id and user_id=u) then
   raise exception 'CV document not found' using errcode='42501';
 end if;
 select coalesce(max(version),0)+1 into v from public.master_cvs where user_id=u;
 update public.master_cvs set is_current=false where user_id=u and is_current;
 insert into public.master_cvs(user_id,version,content,flags,ai,model,source_cv_document_id)
 values(u,v,p_content,p_flags,p_ai,p_model,p_document_id) returning id into m;
 return m;
end $$;
revoke all on function public.replace_master_cv(jsonb,text[],boolean,text,uuid) from public,anon;
grant execute on function public.replace_master_cv(jsonb,text[],boolean,text,uuid) to authenticated;
