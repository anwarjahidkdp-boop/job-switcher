import {stripHtml} from '../../../src/lib/jobs';
export interface Node {tag:string;attrs:Record<string,string>;children:(Node|string)[]}
const blocks=new Set(['p','div','li','br','tr','dt','dd','h1','h2','h3','h4','section','article']);
export function parse(html:string):Node {
 const root:Node={tag:'root',attrs:{},children:[]};const stack=[root];
 const clean=html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<!--[\s\S]*?-->/g,'');
 for(const token of clean.matchAll(/<\/?([a-z][\w:-]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>|([^<]+)/gi)){
  if(token[3]){stack.at(-1)!.children.push(token[3]);continue;}
  const tag=token[1].toLowerCase();if(token[0].startsWith('</')){const at=stack.map(n=>n.tag).lastIndexOf(tag);if(at>0)stack.length=at;continue;}
  const attrs:Record<string,string>={};for(const a of token[2].matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s/>]+)))?/g))attrs[a[1].toLowerCase()]=stripHtml(a[2]??a[3]??a[4]??'');
  const n:Node={tag,attrs,children:[]};stack.at(-1)!.children.push(n);
  if(!/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag)&&!token[0].endsWith('/>'))stack.push(n);
 }
 return root;
}
export const hasClass=(n:Node,name:string)=>(n.attrs.class||'').split(/\s+/).includes(name);
export function all(n:Node,p:(n:Node)=>boolean):Node[]{const out:Node[]=[];const walk=(x:Node)=>{if(p(x))out.push(x);for(const c of x.children)if(typeof c!=='string')walk(c);};walk(n);return out;}
export function text(n:Node,omit:(n:Node)=>boolean=()=>false):string {
 if(omit(n))return '';
 const walk=(x:Node|string):string=>typeof x==='string'?stripHtml(x):omit(x)?'':(blocks.has(x.tag)?'\n':' ')+x.children.map(walk).join('')+(blocks.has(x.tag)?'\n':' ');
 return walk(n).split('\n').map(x=>x.replace(/[\t ]+/g,' ').trim()).filter(Boolean).join('\n');
}
export const href=(n:Node,base:string)=>{try{const u=new URL(n.attrs.href,base);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u:null;}catch{return null;}};
export function field(body:string,labels:string):string|null {
 const lines=body.split('\n').map(x=>x.trim()).filter(Boolean);const re=new RegExp(`^(?:${labels})[ \\t]*(?:[:：][ \\t]*(.*)|$)`,'i');
 for(let i=0;i<lines.length;i++){const m=lines[i].match(re);if(m)return (m[1]?.trim()||lines[i+1]||'').replace(/^[:：]\s*/,'').trim()||null;}
 return null;
}
