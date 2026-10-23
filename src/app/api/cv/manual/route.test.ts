vi.mock("@/lib/server/matches",()=>({refreshMatches:vi.fn().mockResolvedValue(4)}));
import { refreshMatches } from "@/lib/server/matches";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/server/api", () => ({ apiCtx: vi.fn(), unauthorized: () => Response.json({error:"Sign in"},{status:401}), apiError: (e: Error) => Response.json({error:e.message},{status:400}) }));
vi.mock("@/lib/server/state", () => ({ loadFacts: vi.fn().mockResolvedValue([]) }));
import { apiCtx } from "@/lib/server/api";
import { POST } from "./route";
import { POST as retired } from "../edit/route";
import { manualDraft } from "@/lib/manual-cv";
import { DEMO_MASTER } from "@/lib/demo";
const id = "11111111-1111-4111-8111-111111111111";
const rpc = vi.fn().mockResolvedValue({data:"new-id",error:null});
const q = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
q.select.mockReturnValue(q); q.eq.mockReturnValue(q);
const request = (body: unknown) => new Request("https://example.invalid/api/cv/manual", {method:"POST",body:JSON.stringify(body)});
const body = () => ({baseId:id,country:"BD",revision:0,cv:manualDraft(DEMO_MASTER,[])});
beforeEach(() => { vi.clearAllMocks(); vi.mocked(refreshMatches).mockResolvedValue(4); q.maybeSingle.mockResolvedValue({data:{id,content:DEMO_MASTER},error:null}); vi.mocked(apiCtx).mockResolvedValue({userId:"u",db:{from:()=>q,rpc},admin:{}} as never); });
describe("manual editor API", () => {
 it("rejects signed-out writes", async()=>{vi.mocked(apiCtx).mockResolvedValue(null);expect((await POST(request(body()))).status).toBe(401);expect(rpc).not.toHaveBeenCalled();});
 it("rejects invalid fields before saving",async()=>{const b=body();b.cv.experience[0].start="wrong";expect((await POST(request(b))).status).toBe(400);expect(rpc).not.toHaveBeenCalled();});
 it("blocks a stale or foreign base version",async()=>{q.maybeSingle.mockResolvedValue({data:null,error:null});expect((await POST(request(body()))).status).toBe(409);expect(rpc).not.toHaveBeenCalled();});
 it("uses a single atomic RPC with user-derived CV and facts",async()=>{const b=body();b.cv.summary="My own words";const r=await POST(request(b));expect(r.status).toBe(200);expect(refreshMatches).toHaveBeenCalledWith(expect.anything(),"u",{invalidateAi:true});expect(r.headers.get("cache-control")).toBe("no-store");expect(rpc).toHaveBeenCalledWith("save_manual_cv",expect.objectContaining({p_base_id:id,p_country:"BD",p_content:expect.objectContaining({summary:"My own words"}),p_facts:expect.any(Array)}));});
 it("retires paid chat editing even for stale browser tabs",async()=>{const r=await retired();expect(r.status).toBe(410);expect((await r.json()).error).toContain("Edit CV");expect(rpc).not.toHaveBeenCalled();});
});

it("preserves a successful CV save if the full match refresh is temporarily unavailable",async()=>{
 vi.mocked(refreshMatches).mockRejectedValue(new Error("temporary refresh failure"));
 const r=await POST(request(body()));expect(r.status).toBe(200);expect(await r.json()).toMatchObject({id:"new-id",matchingRefreshed:false});
});
