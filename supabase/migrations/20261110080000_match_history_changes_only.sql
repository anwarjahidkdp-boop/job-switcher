-- Match history (match_assessments) keeps a row only when a job's score, fit or gaps actually change.
-- Before, every daily match refresh wrote a fresh row per job even when nothing had changed: 79% of stored rows were
-- such repeats, and they grew by about one row per matched job per user per day. Users' opportunities come from
-- public.matches and are not touched here.
create or replace function public.record_match_assessment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (old.score,old.relevant,old.capped,old.gaps,old.ai_fit)
 is not distinct from (new.score,new.relevant,new.capped,new.gaps,new.ai_fit) then return new; end if;
 insert into public.match_assessments(user_id,job_id,computed_at,assessment_day,score,relevant,capped,gaps,ai_fit)
 values(new.user_id,new.job_id,new.computed_at,(new.computed_at at time zone 'UTC')::date,new.score,new.relevant,new.capped,new.gaps,new.ai_fit)
 on conflict(user_id,job_id,assessment_day) do update set computed_at=excluded.computed_at,score=excluded.score,relevant=excluded.relevant,capped=excluded.capped,gaps=excluded.gaps,ai_fit=excluded.ai_fit;
 return new;
end $$;
revoke all on function public.record_match_assessment() from public,anon,authenticated;

-- Remove the repeats already stored: a row identical to the one before it for the same user and job adds nothing.
delete from public.match_assessments m using (
 select user_id,job_id,computed_at from (
  select user_id,job_id,computed_at,row_number() over w>1
   and (score,relevant,capped,gaps,ai_fit) is not distinct from (lag(score) over w,lag(relevant) over w,lag(capped) over w,lag(gaps) over w,lag(ai_fit) over w) as repeat
  from public.match_assessments window w as (partition by user_id,job_id order by computed_at)) s
 where s.repeat) d
where m.user_id=d.user_id and m.job_id=d.job_id and m.computed_at=d.computed_at;
