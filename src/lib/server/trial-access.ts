import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** An expired trial never grants a new paid feature. Old prepared work stays readable. */
export async function trialAccess(db: SupabaseClient, userId: string): Promise<{active:boolean;expired:boolean;pro:boolean}> {
  const {data,error} = await db.from("subscriptions").select("plan_code,status,trial_ends_at,current_period_end").eq("user_id",userId).maybeSingle();
  if(error)throw error;
  const pro=!!data&&data.plan_code==="pro"&&data.status==="active"&&!!data.current_period_end&&Date.parse(data.current_period_end)>Date.now();
  const activeTrial=!!data&&data.status==="trialing"&&!!data.trial_ends_at&&Date.parse(data.trial_ends_at)>Date.now();
  return {active:pro||activeTrial,expired:!pro&&!activeTrial,pro};
}
export class SubscriptionRequired extends Error {
  constructor(){super("Your trial has ended. Subscribe to prepare new applications.");}
}
export async function requireActiveAccess(db:SupabaseClient,userId:string){
  if(!(await trialAccess(db,userId)).active)throw new SubscriptionRequired();
}
