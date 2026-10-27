import {BOT_UA,robotsAllows} from '../../../src/lib/ingest/robots';import {all,href,parse,text} from './html';
import {detailUrls,nextPage,parseDetail,pathPage,type DiscoveredJob,type SourceDocument} from './parse';import {BD_SOURCES,approvedSource,type BangladeshSource} from './registry';
import {fetchTeletalk} from './teletalk';
import {sourceReviewReason} from './quality';
export type Fetcher=(url:string,init?:RequestInit)=>Promise<Response>;
export class PublicReader {
 private rules=new Map<string,string>();private nextStart=0;
 constructor(private base:string,private fetcher:Fetcher=fetch,private delay=400){}
 private async request(url:string):Promise<Response>{
  for(let attempt=0;attempt<2;attempt++){
   const wait=Math.max(0,this.nextStart-Date.now());this.nextStart=Math.max(Date.now(),this.nextStart)+this.delay;if(wait)await new Promise(r=>setTimeout(r,wait));
   try {const r=await this.fetcher(url,{headers:{'user-agent':BOT_UA,accept:'text/html,application/json,application/pdf;q=0.9,*/*;q=0.5'},redirect:'manual',signal:AbortSignal.timeout(20000)});
    if(attempt===0&&(r.status===429||r.status>=500)){await r.body?.cancel();await new Promise(r=>setTimeout(r,250));continue;}return r;
   }catch(e){if(attempt===1)throw e;await new Promise(r=>setTimeout(r,250));}
  }throw Error('Source request failed');
 }
 async bytes(url:string):Promise<{bytes:Uint8Array;type:string}>{
  const target=new URL(url);const base=new URL(this.base);
  if(target.protocol!=='https:'||target.username||target.password||target.hostname.replace(/^www\./,'')!==base.hostname.replace(/^www\./,''))throw Error('Source URL left its configured host');
  if(!this.rules.has(target.origin)){
   const r=await this.request(target.origin+'/robots.txt');if(!r.ok&&![404,410].includes(r.status))throw Error(`robots.txt returned ${r.status}`);
   this.rules.set(target.origin,r.ok?await this.cappedText(r):'');
  }
  if(!robotsAllows(this.rules.get(target.origin)!,target.pathname+target.search,'jobpaobot'))throw Error('robots.txt disallows this URL');
  const r=await this.request(target.href);if([301,302,303,307,308].includes(r.status)){
   const location=r.headers.get('location');if(!location)throw Error('Redirect without Location');const next=new URL(location,target);
   if(next.href===target.href)throw Error('Redirect loop');
   // Redirect targets get their own robots check. A depth guard prevents loops.
   return this.redirect(next.href,1);
  }
  if(!r.ok)throw Error(`Source HTTP ${r.status}`);return {bytes:await this.capped(r),type:r.headers.get('content-type')||''};
 }
 private async redirect(url:string,depth:number):Promise<{bytes:Uint8Array;type:string}>{if(depth>3)throw Error('Too many redirects');const target=new URL(url),base=new URL(this.base);if(target.protocol!=='https:'||target.hostname.replace(/^www\./,'')!==base.hostname.replace(/^www\./,''))throw Error('Source redirected off host');
  if(!this.rules.has(target.origin)){const r=await this.request(target.origin+'/robots.txt');if(!r.ok&&![404,410].includes(r.status))throw Error(`robots.txt returned ${r.status}`);this.rules.set(target.origin,r.ok?await this.cappedText(r):'');}
  if(!robotsAllows(this.rules.get(target.origin)!,target.pathname+target.search,'jobpaobot'))throw Error('robots.txt disallows redirect target');const r=await this.request(url);
  if([301,302,303,307,308].includes(r.status)){const loc=r.headers.get('location');if(!loc)throw Error('Missing redirect');return this.redirect(new URL(loc,url).href,depth+1);}if(!r.ok)throw Error(`Source HTTP ${r.status}`);return {bytes:await this.capped(r),type:r.headers.get('content-type')||''};
 }
 private async capped(r:Response){if(Number(r.headers.get('content-length')||0)>15000000)throw Error('Source response too large');if(!r.body)return new Uint8Array();const reader=r.body.getReader();const parts:Uint8Array[]=[];let count=0;try{for(;;){const {done,value}=await reader.read();if(done)break;count+=value.byteLength;if(count>15000000){await reader.cancel();throw Error('Source response too large');}parts.push(value);}}finally{reader.releaseLock();}return Buffer.concat(parts);}
 private async cappedText(r:Response){return new TextDecoder().decode(await this.capped(r));}
 async html(url:string){const r=await this.bytes(url);if(r.type&&!/html|text|json/.test(r.type))throw Error('Expected HTML, received binary');return new TextDecoder().decode(r.bytes);}
}
export interface BangladeshBatch {jobs:DiscoveredJob[];documents:(SourceDocument&{state:'needs_review'|'fetch_failed'})[];checkedUrls:string[];nextUrl:string|null;pages:number;failures:number}
export async function fetchBangladesh(key:string,today:string,opts:{fetcher?:Fetcher;cursor?:string|null;pages?:number;retryUrls?:string[];delay?:number}={}):Promise<BangladeshBatch>{
 const c=BD_SOURCES.find(x=>x.key===key);if(!c||!approvedSource(c))throw Error('Source quality review required before collection');if(!c.enabled)throw Error(c.note||'Unsupported Bangladesh source');const reader=new PublicReader(c.url,opts.fetcher,opts.delay??400);
 if(c.mode==='teletalk')return fetchTeletalk(reader,today,opts);
 const result:BangladeshBatch={jobs:[],documents:[],checkedUrls:[],nextUrl:null,pages:0,failures:0};
 const handle=async(url:string)=>{try{const html=await reader.html(url);const parsed=parseDetail(html,url,c,today);result.jobs.push(...parsed.jobs);result.documents.push(...parsed.documents.map(d=>({...d,state:'needs_review' as const})));result.checkedUrls.push(url);}catch(e){result.failures++;result.documents.push({url,title:'Source page',kind:'article',reason:String(e).slice(0,300),publishedAt:null,state:'fetch_failed'});}};
 const seen=new Set<string>();const consume=async(html:string,url:string)=>{
  const links=detailUrls(html,url,c).filter(u=>!seen.has(u));if(links.length>700)throw Error('Source listing exceeds safe detail limit');
  for(let i=0;i<links.length;i+=2){for(const u of links.slice(i,i+2))seen.add(u);await Promise.all(links.slice(i,i+2).map(handle));}
 };
 const head=await reader.html(c.url);result.pages++;
 if(c.mode==='documents'){result.documents.push(...documentLinks(head,c).map(d=>({...d,state:'needs_review' as const})));return result;}
 await consume(head,c.url);
 // Only job pages are retried here; a failed listing page is resumed from the saved cursor instead.
 for(const url of (opts.retryUrls||[]).filter(u=>{try{return c.detail.test(new URL(u).pathname);}catch{return false;}}).slice(0,20))if(!seen.has(url)){seen.add(url);await handle(url);}
 let next=opts.cursor||nextPage(head,c.url,c);const visited=new Set([c.url]);const max=Math.min(50,Math.max(1,opts.pages||4));
 while(next&&result.pages<max){
  const u=new URL(next);const base=new URL(c.url);if(u.origin!==base.origin||(c.pagePath?pathPage(u.href,c)==null:u.pathname!==base.pathname)||visited.has(u.href))throw Error('Unsafe or cyclic pagination cursor');visited.add(u.href);
  // A later listing page that fails keeps the jobs already read; the page is recorded and retried from the saved cursor.
  let html:string;try{html=await reader.html(u.href);}catch(e){result.failures++;result.documents.push({url:u.href,title:'Listing page',kind:'article',reason:String(e).slice(0,300),publishedAt:null,state:'fetch_failed'});break;}
  result.pages++;await consume(html,u.href);next=nextPage(html,u.href,c);
 }
 result.nextUrl=next;result.jobs=[...new Map(result.jobs.map(j=>[j.externalId,j])).values()];
 result.jobs=result.jobs.filter(j=>{const reason=sourceReviewReason(j,c,today);if(!reason)return true;result.documents.push({url:j.discovery.url,title:j.title,kind:'article',reason,publishedAt:j.publishedAt,state:'needs_review'});return false;});
 if(!seen.size)throw Error('No job links found: listing structure changed; refusing a false empty success');return result;
}
export function documentLinks(html:string,c:BangladeshSource):SourceDocument[]{
 const root=parse(html);const out:SourceDocument[]=[];
 for(const n of all(root,n=>n.tag==='a')){const u=href(n,c.url);if(!u||!c.detail.test(u.pathname))continue;const label=text(n)||n.attrs.title||'Recruitment circular';out.push({url:u.href,title:label.slice(0,300),kind:/\.pdf$/i.test(u.pathname)?'pdf':'image',reason:'Extract and verify individual positions and deadlines before matching',publishedAt:null});}
 // E-paper galleries commonly link to full-size pages via <a>; inline logos/ads are never collected.
 return [...new Map(out.map(d=>[d.url,d])).values()];
}
export {BD_SOURCES};export type {BangladeshSource};
