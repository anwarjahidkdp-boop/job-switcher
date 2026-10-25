import {normaliseJobText,stripHtml} from '../../../src/lib/jobs';
import {extractJobPostings,postingToJob,type JobPosting} from '../../../src/lib/ingest/jsonld';
import type {IngestedJob} from '../../../src/lib/ingest/ats';
import {all,field,hasClass,href,parse,text,type Node} from './html';import {sourceDate} from './dates';import type {BangladeshSource} from './registry';
export interface SourceDocument {url:string;title:string;kind:'article'|'pdf'|'image';reason:string;publishedAt:string|null}
export interface DiscoveredJob extends IngestedJob {discovery:{url:string;originalUrl:string|null;source:string;evidence:'structured'|'labelled'|'ai_extracted'}}
const ignored=(n:Node)=>['header','footer','nav','aside'].includes(n.tag)||['rm-container','related-news','related-stories','advertisement','ads'].some(c=>hasClass(n,c));
export function detailUrls(html:string,url:string,config:BangladeshSource):string[]{
 const root=parse(html);const base=new URL(url);const found=all(root,n=>n.tag==='a').flatMap(n=>{const u=href(n,url);if(!u||u.hostname.replace(/^www\./,'')!==base.hostname.replace(/^www\./,'')||!config.detail.test(u.pathname))return [];u.host=base.host;u.protocol='https:';u.hash='';return [u.href];});
 if(config.key==='prothomalo'){
  const m=html.match(/<script[^>]*id=["']static-page["'][^>]*>([\s\S]*?)<\/script>/i);
  if(m){const state=JSON.parse(m[1]);for(const item of state.qt?.data?.collection?.items||[]){const raw=item.story?.url;if(typeof raw==='string'){const u=new URL(raw,url);if(u.origin===base.origin&&config.detail.test(u.pathname))found.push(u.href);}}}
 }
 return [...new Set(found)];
}
export function nextPage(html:string,url:string,config:BangladeshSource):string|null{
 if(!config.pageParam)return null;const root=parse(html);const base=new URL(url);const current=Number(base.searchParams.get(config.pageParam)||1);
 const pages=all(root,n=>n.tag==='a').map(n=>href(n,url)).filter((u):u is URL=>!!u&&u.origin===base.origin&&u.pathname===base.pathname&&Number(u.searchParams.get(config.pageParam!)||0)===current+1);
 return pages[0]?.href||null;
}
function originalLink(root:Node,url:string,c:BangladeshSource):string|null{
 if(c.authority)return url;
 const links=all(root,n=>n.tag==='a').filter(n=>/^(?:apply(?: now| here| online)?|আবেদন(?: করুন| লিংক| করতে)?|মূল বিজ্ঞপ্তি|অফিশিয়াল বিজ্ঞপ্তি|অফিশিয়াল বিজ্ঞপ্তি|official (?:notice|circular)|source|সূত্র)$/i.test(text(n).trim()));
 for(const n of links){const u=href(n,url);if(u&&u.hostname!==new URL(url).hostname&&!/facebook|twitter|linkedin\.com\/shar|google\.com\/ads|doubleclick/.test(u.hostname+u.pathname))return u.href;}
 return null;
}
function makeJob(post:JobPosting,url:string,c:BangladeshSource,today:string,root:Node):DiscoveredJob|null{
 const p={...post,validThrough:sourceDate(post.validThrough)||undefined,datePosted:sourceDate(post.datePosted)||undefined};
 if(p.validThrough&&p.validThrough<today)return null;
 let company=typeof p.hiringOrganization==='string'?p.hiringOrganization:p.hiringOrganization?.name;
 if(!company&&c.key==='bdrecruit'&&p.title?.includes('|')){const parts=p.title.split('|');company=parts.pop()!.trim();p.title=parts.join('|').trim();p.hiringOrganization={name:company};}
 if(!company&&!c.company)return null;
 const job=postingToJob(p,{country:'BD',companyFallback:c.company,sourceLabel:c.name,pageUrl:url,today});if(!job||job.country!=='BD')return null;
 job.publishedAt=sourceDate(post.datePosted);job.apply=job.apply.method==='unknown'?{method:'portal',target:url}:job.apply;
 if(job.apply.method==='portal')job.apply.target=job.apply.target||url;
 const exp=post.experienceRequirements;if(exp&&typeof exp==='object'&&'monthsOfExperience' in exp){const months=Number((exp as {monthsOfExperience:unknown}).monthsOfExperience);if(Number.isFinite(months)&&months>=0)job.minYears=months/12;}
 return {...job,externalId:url,discovery:{url,originalUrl:originalLink(root,url,c),source:c.name,evidence:'structured'}};
}
export function parseDetail(html:string,url:string,c:BangladeshSource,today:string):{jobs:DiscoveredJob[];documents:SourceDocument[]}{
 const root=parse(html);const structured=extractJobPostings(html).filter(p=>!p.url||p.url.replace(/\/$/,'')===url.replace(/\/$/,''));if(structured.length){
 const deadlines=new Set(structured.map(p=>sourceDate(p.validThrough)).filter(Boolean));
 if(deadlines.size>1)return {jobs:[],documents:[{url,title:String(structured[0].title||'Job posting'),kind:'article',reason:'Conflicting structured application deadlines require verification',publishedAt:null}]};
 const jobs=structured.map(p=>makeJob(p,url,c,today,root)).filter((x):x is DiscoveredJob=>!!x);return {jobs:jobs.slice(-1),documents:[]};}

 let bodyNode=all(root,n=>hasClass(n,'news-details')||hasClass(n,'job-description')||hasClass(n,'job-details')||n.tag==='article')[0]||root;
 if(c.mode==='dohaj'){
  const heading=all(root,n=>n.tag==='h3'&&text(n)==='Job Description')[0];
  if(heading){const parent=all(root,n=>n.children.includes(heading))[0];if(parent)bodyNode=parent;}
 }
 let body=text(bodyNode,ignored);
 if(c.key==='dhakapost'){const at=body.lastIndexOf('প্রতিষ্ঠানের নাম:');if(at>=0)body=body.slice(at);}
 const headline=text(all(root,n=>n.tag==='h1')[0]||root).split('\n')[0].slice(0,250);
 let company=field(body,'Company Name|Company|প্রতিষ্ঠানের নাম|প্রতিষ্ঠান|সংস্থার নাম')||c.company;
 let title=field(body,'Title|Position(?: Name)?|Job Title|পদের নাম|পদবি|পদবী')||(c.type==='portal'?headline:null);
 if(c.key==='bdjobstoday')body=body.slice(body.indexOf(text(all(root,n=>n.tag==='h1')[0]||root)));
 if(c.key==='jobcombd'){company=text(all(root,n=>n.tag==='h1')[0]||root).split('\n')[0];title=text(all(root,n=>n.tag==='h2')[0]||root).split('\n')[0];}
 if(c.key==='bdjobstoday'){company=text(all(root,n=>n.tag==='h1')[0]||root).split('\n')[0];title=field(body,'Position');}
 if(c.key==='morejobs'){
  title=text(all(root,n=>hasClass(n,'job-title'))[0]||root).split('\n')[0];
  const line=all(root,n=>hasClass(n,'company-line'))[0];const name=line&&all(line,n=>n.tag==='span')[0];company=name?text(name):undefined;
  body=body.split('📢')[0];
 }
 if(c.key==='chakrirkhabar'){
  const h=all(root,n=>n.tag==='h4'&&hasClass(n,'mb-10'))[0];title=h?text(h):null;
  if(h){const parent=all(root,n=>n.children.includes(h))[0];const a=parent&&all(parent,n=>n.tag==='a')[0];company=a?text(a):undefined;}
  body=body.split('More Jobs From')[0];
 }
 const deadline=sourceDate(field(body,'Application Deadline|Deadline|Last Date(?: of Application)?|আবেদনের শেষ তারিখ|আবেদনের শেষ সময়|আবেদনের শেষ সময়|আবেদনের শেষ তারিখ ও সময়'));
 const posted=sourceDate(field(body,'Published|Published On|Posted|প্রকাশের তারিখ'));
 if(deadline&&deadline<today)return {jobs:[],documents:[]};
 if(c.key==='bdjobstoday'||c.key==='chakrirkhabar')return {jobs:[],documents:[{url,title:title||headline,kind:'article',reason:'Image-based circular: eligibility must be extracted from the original advertisement',publishedAt:posted}]};
 if(!title||!company||body.length<80||(c.type==='newspaper'&&!deadline))return {jobs:[],documents:[{url,title:headline,kind:'article',reason:'Needs explicit position, employer and trustworthy deadline before matching',publishedAt:posted}]};
 const location=field(body,'Job Location|Location|কর্মস্থল|চাকরির স্থান');
 const job=normaliseJobText({title:stripHtml(title),company:stripHtml(company),country:'BD',location,text:body,url,source:c.name,deadline,publishedAt:posted,today});job.publishedAt=posted;job.apply=job.apply.method==='email'?job.apply:{method:'portal',target:url};
 return {jobs:[{...job,externalId:url,description:body,discovery:{url,originalUrl:originalLink(bodyNode,url,c),source:c.name,evidence:'labelled'}}],documents:[]};
}
