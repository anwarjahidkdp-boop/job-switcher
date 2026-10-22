-- Provider verification stays in server code; this service-only transaction atomically
-- records approval/refund and changes entitlement. No historical payment is rewritten.
create or replace function public.settle_payment(
  p_id uuid, p_method text, p_from text[], p_review jsonb, p_refund boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.payments; e timestamptz; provider text;
begin
  select * into p from public.payments where id=p_id for update;
  if not found or p.method <> p_method then raise exception 'payment not found'; end if;
  if not p.status = any(p_from) then
    return jsonb_build_object('changed',false,'status',p.status,'period_end',p.period_end);
  end if;
  if p.user_id is null then raise exception 'payment owner no longer exists'; end if;
  if p_refund and (p.method <> 'lemonsqueezy' or p.status <> 'approved'
     or p.provider_order_id is distinct from p_review->>'provider_order_id') then
    raise exception 'refund does not match approved order';
  end if;
  if not p_refund and p.status not in ('initiated','pending','rejected') then raise exception 'invalid approval state'; end if;
  if coalesce(p.period_days,0) <= 0 then raise exception 'invalid payment period'; end if;
  provider := case p.method when 'bkash_manual' then 'bkash' else p.method end;
  -- The subscription row is locked by UPDATE; another approved payment cannot lose this extension.
  e := public.extend_pro(p.user_id, case when p_refund then -p.period_days else p.period_days end,
       provider, coalesce(p_review->>'trx_id',p.trx_id));
  update public.payments set status=case when p_refund then 'refunded' else 'approved' end,
    period_end=e, trx_id=coalesce(p_review->>'trx_id',trx_id),
    provider_order_id=coalesce(p_review->>'provider_order_id',provider_order_id),
    payer_msisdn=coalesce(p_review->>'payer_msisdn',payer_msisdn),
    provider_response=coalesce(p_review->'provider_response',provider_response),
    reviewed_by=p_review->>'reviewed_by', reviewed_at=now(), review_note=p_review->>'review_note'
  where id=p_id;
  return jsonb_build_object('changed',true,'status',case when p_refund then 'refunded' else 'approved' end,'period_end',e);
end $$;
revoke all on function public.settle_payment(uuid,text,text[],jsonb,boolean) from public,anon,authenticated;
grant execute on function public.settle_payment(uuid,text,text[],jsonb,boolean) to service_role;
