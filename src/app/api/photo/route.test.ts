import {beforeEach,expect,it,vi} from 'vitest';
vi.mock('@/lib/server/api',()=>({apiCtx:vi.fn(),unauthorized:()=>new Response(null,{status:401}),apiError:()=>new Response(null,{status:500})}));
import {apiCtx} from '@/lib/server/api';
import {POST} from './route';
function setup(fail=false){
 const upload=vi.fn().mockResolvedValue({error:null}),remove=vi.fn().mockResolvedValue({error:null});
 let patch:Record<string,unknown>|undefined;
 const db={storage:{from:()=>({upload,remove})},from:()=>{const q={select:()=>q,eq:()=>q,update:(p:Record<string,unknown>)=>{patch=p;return q;},single:async()=>patch?{data:{id:'owner'},error:fail?new Error('save failed'):null}:{data:{photo_path:'owner/photo.jpg'},error:null}};return q;}};
 vi.mocked(apiCtx).mockResolvedValue({db,admin:db,userId:'owner'} as unknown as NonNullable<Awaited<ReturnType<typeof apiCtx>>>);
 return {upload,remove,patch:()=>patch};
}
function request(){const data=new FormData();data.set('photo',new File([new Uint8Array([255,216,255,217])],'photo.jpg',{type:'image/jpeg'}));return new Request('https://jobpao.app/api/photo',{method:'POST',body:data});}
beforeEach(()=>vi.clearAllMocks());
it('uses a fresh owner-scoped path so a replacement does not show the cached old photo',async()=>{
 const x=setup();expect((await POST(request())).status).toBe(200);
 const path=x.upload.mock.calls[0][0];expect(path).toMatch(/^owner\/photo-[a-f0-9-]+\.jpg$/);
 expect(x.patch()).toEqual({photo_path:path});expect(x.remove).toHaveBeenCalledWith(['owner/photo.jpg']);
});
it('retains the old photo and removes the new upload when the profile update fails',async()=>{
 const x=setup(true);expect((await POST(request())).status).toBe(500);
 expect(x.remove).toHaveBeenCalledWith([x.upload.mock.calls[0][0]]);
 expect(x.remove).not.toHaveBeenCalledWith(['owner/photo.jpg']);
});
