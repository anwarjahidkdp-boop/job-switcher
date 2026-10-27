import {it,expect,vi,afterEach} from "vitest";
afterEach(()=>{vi.unstubAllEnvs();vi.resetModules();});
it.each(["","synthetic-public-site-key"])("allows only the configured challenge provider while keeping framing protection (%s)",async key=>{
 vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY",key);vi.resetModules();const {default:config}=await import("../../next.config");
 const groups=await config.headers!();const csp=groups[0].headers.find(h=>h.key==="Content-Security-Policy")!.value;
 expect(csp).toContain("frame-ancestors 'none'");expect(csp).toContain("object-src 'none'");
 for(const directive of ["script-src","connect-src","frame-src"]){const value=csp.split("; ").find(d=>d.startsWith(directive))!;expect(value.includes("https://challenges.cloudflare.com")).toBe(!!key);}
 expect(csp).not.toContain("frame-src *");
});
