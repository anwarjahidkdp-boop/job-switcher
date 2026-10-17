import { describe, expect, it } from "vitest";
import { z } from "zod";
import { GeminiProvider } from "./gemini";
import { AIError } from "./provider";

function fakeFetch(status: number, body: unknown, seen: { url?: string; init?: RequestInit } = {}) {
  return (async (url: string, init?: RequestInit) => {
    seen.url = url; seen.init = init;
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
}
const ok = (text: string) => ({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20 } });

describe("Gemini REST adapter", () => {
  it("sends JSON-schema requests and validates the reply", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const p = new GeminiProvider("k", fakeFetch(200, ok('{"name":"Rahim"}'), seen));
    const r = await p.generateJSON({ tier: "fast", system: "s", prompt: "p", schema: z.object({ name: z.string() }) });
    expect(r.data.name).toBe("Rahim");
    expect(r.usage).toMatchObject({ inputTokens: 100, outputTokens: 20, model: "gemini-2.5-flash" });
    expect(seen.url).toContain("/models/gemini-2.5-flash:generateContent");
    expect((seen.init?.headers as Record<string, string>)["x-goog-api-key"]).toBe("k");
    const body = JSON.parse(String(seen.init?.body));
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseJsonSchema.type).toBe("object");
  });
  it("rejects replies that do not match the schema", async () => {
    const p = new GeminiProvider("k", fakeFetch(200, ok('{"nope":1}')));
    await expect(p.generateJSON({ tier: "fast", system: "s", prompt: "p", schema: z.object({ name: z.string() }) })).rejects.toThrow(AIError);
  });
  it("sends page images inline and maps errors", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const p = new GeminiProvider("k", fakeFetch(200, ok("CV TEXT"), seen));
    const r = await p.readImages({ tier: "fast", system: "s", prompt: "p", images: [{ mediaType: "image/jpeg", data: "AAAA" }] });
    expect(r.text).toBe("CV TEXT");
    expect(JSON.parse(String(seen.init?.body)).contents[0].parts[0].inlineData).toEqual({ mimeType: "image/jpeg", data: "AAAA" });
    await expect(new GeminiProvider("k", fakeFetch(429, {})).generateText({ tier: "fast", system: "s", prompt: "p" })).rejects.toMatchObject({ code: "rate_limited" });
    await expect(new GeminiProvider("k", fakeFetch(200, { promptFeedback: { blockReason: "SAFETY" } })).generateText({ tier: "fast", system: "s", prompt: "p" })).rejects.toMatchObject({ code: "refused" });
  });
});
