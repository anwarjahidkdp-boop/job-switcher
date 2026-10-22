import type { SupabaseClient } from "@supabase/supabase-js";
export interface CareerMetrics { jobs_analysed:number; relevant:number; strong:number; prepared:number; applied:number; interviews:number; offers:number; top_gap:string|null; next_deadline:string|null }
export interface CareerReport { id:string; kind:"trial"|"weekly"; period_start:string; period_end:string; metrics:CareerMetrics }
/** Previous completed ISO week in UTC; retries always use the same closed interval. */
export function reportWeek(now:Date) {
 const end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
 end.setUTCDate(end.getUTCDate()-((end.getUTCDay()+6)%7));
 return {start:new Date(end.getTime()-7*86400000),end};
}
export function reportBody(m:CareerMetrics) {
 return `Jobs checked for you: ${m.jobs_analysed} · Relevant: ${m.relevant} · Strong Fit: ${m.strong} · Prepared: ${m.prepared} · Applied: ${m.applied} · Interviews: ${m.interviews} · Offers: ${m.offers}${m.top_gap?` · Top gap: ${m.top_gap}`:""}${m.next_deadline?` · Next deadline: ${m.next_deadline}`:""}.`;
}
export async function careerMetrics(db:SupabaseClient,userId:string,start:Date,end:Date) {
 const {data,error}=await db.rpc("career_metrics",{p_user:userId,p_start:start.toISOString(),p_end:end.toISOString()});
 if(error)throw error;return data as CareerMetrics;
}
export async function saveCareerReport(db:SupabaseClient,userId:string,kind:"trial"|"weekly",start:Date,end:Date) {
 const {data,error}=await db.rpc("save_career_report",{p_user:userId,p_kind:kind,p_start:start.toISOString(),p_end:end.toISOString()});
 if(error)throw error;return (Array.isArray(data)?data[0]:data) as CareerReport;
}
export async function latestCareerReports(db:SupabaseClient,userId:string) {
 const {data,error}=await db.from("career_reports").select("id,kind,period_start,period_end,metrics").eq("user_id",userId).order("created_at",{ascending:false}).limit(6);
 if(error)throw error;return (data||[]) as CareerReport[];
}
