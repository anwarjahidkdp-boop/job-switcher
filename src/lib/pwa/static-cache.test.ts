import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {expect,it,vi} from 'vitest';
const source=readFileSync(new URL('../../../public/sw.js',import.meta.url),'utf8');
function worker(){
 const handlers:Record<string,(event:unknown)=>unknown>={};
 const saved=new Map<string,unknown>();
 const cache={match:vi.fn(async(r:{url:string})=>saved.get(r.url)),put:vi.fn(async(r:{url:string},v:unknown)=>{saved.set(r.url,v)}),keys:async()=>[],delete:vi.fn()};
 const fetch=vi.fn(async()=>({status:200,type:'basic',clone:()=>({body:'static asset'})}));
 const caches={open:vi.fn(async()=>cache),keys:async()=>['jobpao-static-v0','unrelated'],delete:vi.fn(async()=>true)};
 const self={location:{origin:'https://jobpao.app'},skipWaiting:vi.fn(),clients:{claim:vi.fn()},addEventListener:(name:string,fn:(e:unknown)=>unknown)=>{handlers[name]=fn}};
 runInNewContext(source,{self,caches,fetch,URL});
 return{handlers,cache,fetch,caches};
}
it('never caches authenticated pages, CV downloads, API or cross-origin requests',()=>{
 const w=worker();
 for(const [path,method] of [['/inbox','GET'],['/api/cv/download','GET'],['/profile?_rsc=x','GET'],['/_next/static/chunk.js','POST'],['https://other.test/_next/static/chunk.js','GET']]){
  const respondWith=vi.fn();
  w.handlers.fetch({request:{url:new URL(path,'https://jobpao.app').href,method},respondWith,waitUntil:vi.fn()});
  expect(respondWith).not.toHaveBeenCalled();
 }
 expect(w.fetch).not.toHaveBeenCalled();expect(w.caches.open).not.toHaveBeenCalled();
});
it('reuses immutable build assets and only retires its own old caches',async()=>{
 const w=worker();const pending:Promise<unknown>[]=[];
 const waitUntil=(p:Promise<unknown>)=>pending.push(p);
 const request={url:'https://jobpao.app/_next/static/hash.js',method:'GET'};
 const load=async()=>{let result:Promise<unknown>|undefined;w.handlers.fetch({request,waitUntil,respondWith:(p:Promise<unknown>)=>{result=p}});await result;await Promise.all(pending)};
 await load();await load();expect(w.fetch).toHaveBeenCalledTimes(1);expect(w.cache.put).toHaveBeenCalledTimes(1);
 w.handlers.activate({waitUntil});await Promise.all(pending);
 expect(w.caches.delete).toHaveBeenCalledWith('jobpao-static-v0');expect(w.caches.delete).not.toHaveBeenCalledWith('unrelated');
});

it('falls back to the network if browser cache storage is unavailable',async()=>{
 const w=worker();w.caches.open.mockRejectedValueOnce(new Error('storage disabled'));
 let result:Promise<unknown>|undefined;
 w.handlers.fetch({request:{url:'https://jobpao.app/_next/static/hash.js',method:'GET'},waitUntil:vi.fn(),respondWith:(p:Promise<unknown>)=>{result=p}});
 await expect(result).resolves.toMatchObject({status:200});
 expect(w.fetch).toHaveBeenCalledTimes(1);
});
