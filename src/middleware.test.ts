import {afterEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const create=vi.hoisted(()=>vi.fn());vi.mock('@supabase/ssr',()=>({createServerClient:create}));
import {middleware} from './middleware';
afterEach(()=>vi.unstubAllEnvs());
it('lets the logout handler run without a redundant Auth refresh',async()=>{vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://example.supabase.co');vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','public');const r=await middleware(new NextRequest('https://jobpao.app/auth/signout',{method:'POST',headers:{origin:'https://jobpao.app'}}));expect(r.status).toBe(200);expect(create).not.toHaveBeenCalled();});
it('rejects a cross-site logout before session mutation',async()=>{const r=await middleware(new NextRequest('https://jobpao.app/auth/signout',{method:'POST',headers:{origin:'https://other.example','sec-fetch-site':'cross-site'}}));expect(r.status).toBe(403);expect(create).not.toHaveBeenCalled();});
