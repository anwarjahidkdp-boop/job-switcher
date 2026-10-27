import type { SupabaseClient } from "@supabase/supabase-js";
/** v 2 = counted like Home (jobs found, Top matches 70%+, Strong Fit 90%+); reports without v were saved before that. */
export interface CareerMetrics { v?:2; jobs_analysed:number; relevant:number; strong:number; prepared:number; applied:number; interviews:number; offers:number; top_gap:string|null; next_deadline:string|null }
export interface CareerReport { id:string; kind:"trial"|"weekly"; period_start:string; period_end:string; metrics:CareerMetrics }
/** Previous completed ISO week in UTC; retries always use the same closed interval. */
export function reportWeek(now:Date) {
 const end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
 end.setUTCDate(end.getUTCDate()-((end.getUTCDay()+6)%7));
 return {start:new Date(end.getTime()-7*86400000),end};
}
export function reportBody(m:CareerMetrics) {
 const jobs=m.v===2?`Jobs found for you: ${m.jobs_analysed} · Top matches (70%+): ${m.relevant} · Strong Fit (90%+): ${m.strong}`:`Jobs checked for you: ${m.jobs_analysed} · Relevant: ${m.relevant} · Top matches: ${m.strong}`;
 return `${jobs} · Prepared: ${m.prepared} · Applied: ${m.applied} · Interviews: ${m.interviews} · Offers: ${m.offers}${m.top_gap?` · Top gap: ${m.top_gap}`:""}${m.next_deadline?` · Next deadline: ${m.next_deadline}`:""}.`;
}
/** Tile labels for a saved report, matching the words Home uses for the same numbers. */
export function reportTiles(m:CareerMetrics):[string,number][] {
 const jobs:[string,number][]=m.v===2?[["Jobs found for you",m.jobs_analysed],["Top matches (70%+)",m.relevant],["Strong Fit (90%+)",m.strong]]:[["Jobs checked for you",m.jobs_analysed],["Relevant opportunities",m.relevant],["Strong Fits (90%+)",m.strong]];
 return [...jobs,["Applications prepared",m.prepared],["Applications submitted",m.applied],["Interviews",m.interviews],["Offers",m.offers]];
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
