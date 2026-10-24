import {it,expect} from 'vitest';
import {trustedMutation,readLimitedText} from './request-security';
it('blocks cross-origin and cross-site browser mutations, including same-site hostile subdomains',()=>{
 const req=(origin:string,site='same-origin',method='POST')=>new Request('https://jobpao.app/api/account/delete',{method,headers:{origin,'sec-fetch-site':site}});
 expect(trustedMutation(req('https://jobpao.app'))).toBe(true);
 expect(trustedMutation(req('https://evil.example'))).toBe(false);
 expect(trustedMutation(req('https://evil.jobpao.app','same-site'))).toBe(false);
 expect(trustedMutation(req('null'))).toBe(false);
 expect(trustedMutation(req('https://jobpao.app','cross-site'))).toBe(false);
 expect(trustedMutation(new Request('https://jobpao.app/api/health'))).toBe(true);
});
it('limits streamed request bytes without Content-Length and preserves normal signed text',async()=>{
 const r=new Request('https://jobpao.app',{method:'POST',body:'বাংলা'});
 expect(await readLimitedText(r,15)).toBe('বাংলা');
 await expect(readLimitedText(new Request('https://jobpao.app',{method:'POST',body:'123456'}),5)).rejects.toThrow('too large');
 await expect(readLimitedText(new Request('https://jobpao.app',{method:'POST',headers:{'content-length':'1000'},body:'a'}),5)).rejects.toThrow('too large');
});
