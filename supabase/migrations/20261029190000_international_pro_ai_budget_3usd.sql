-- Keep the reservation-time hard cap aligned with the server-side international Pro budget.
-- Bangladesh Pro remains at US$1 per rolling 30 days; trial remains unchanged.
CREATE OR REPLACE FUNCTION public.reserve_ai_call(p_user uuid, p_feature text, p_provider text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare b record; cap bigint; recent int; usage_id bigint;
begin
 perform public.expire_ai_reservations();
 perform 1 from public.subscriptions where user_id=p_user for update;
 if not found then raise exception 'over_cap'; end if;
 if exists(select 1 from public.ai_usage where user_id=p_user and model='__reserved__') then raise exception 'unresolved'; end if;
 select * into b from public.ai_budget(p_user);
 if not found then raise exception 'over_cap'; end if;
 if b.status='trialing' and (b.trial_ends_at is null or b.trial_ends_at<=now()) then raise exception 'trial_expired'; end if;
 if b.status='active' and b.current_period_end is not null and b.current_period_end<=now() then raise exception 'plan_expired'; end if;
 if b.status not in ('trialing','active') then raise exception 'plan_expired'; end if;
 cap:=b.cap_micro_usd;
 if b.plan_code='pro' and exists(select 1 from public.profiles where id=p_user and home_country<>'BD') then cap:=greatest(cap,3000000); end if;
 if b.spent_micro_usd>=cap then raise exception 'over_cap'; end if;
 select count(*) into recent from public.ai_usage where user_id=p_user and created_at>=now()-interval '10 minutes';
 if p_feature not in ('match_check','alert_parse') and recent>=30 then raise exception 'rate_limited'; end if;
 insert into public.ai_usage(user_id,feature,provider,model,cost_micro_usd,ok)
 values(p_user,'__reservation__',p_provider,'__reserved__',cap-b.spent_micro_usd,false) returning id into usage_id;
 return usage_id;
end $function$;
