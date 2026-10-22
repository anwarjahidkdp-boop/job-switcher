// Optional Google Gemini adapter over the public REST API (generativelanguage.googleapis.com, v1beta).
// Plain fetch keeps the Worker bundle small (the official SDK added ~1 MB). Enabled with AI_PROVIDER=gemini + GEMINI_API_KEY.
import { z } from "zod";
import { AIError, type AIProvider, type AITier, type JSONRequest, type PageImage, type TextRequest, type VisionRequest } from "./provider";
import { costMicroUsd } from "./pricing";

const MODELS: Record<AITier, string> = {
  fast: process.env.GEMINI_MODEL_FAST || "gemini-2.5-flash",
  quality: process.env.GEMINI_MODEL_QUALITY || "gemini-2.5-pro",
};
const BASE = "https://generativelanguage.googleapis.com/v1beta";

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  constructor(private apiKey: string, private fetchImpl: typeof fetch = fetch) {}

  private async run(tier: AITier, system: string, prompt: string, maxTokens: number | undefined, schema?: z.ZodType, images: PageImage[] = []) {
    const model = MODELS[tier];
    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [...images.map((i) => ({ inlineData: { mimeType: i.mediaType, data: i.data } })), { text: prompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens ?? 16000,
        ...(schema ? { responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(schema) } : {}),
      },
    };
    let res: Response;
    try {
      res = await this.fetchImpl(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (e) {
      throw new AIError("upstream", e instanceof Error ? e.message : String(e));
    }
    if (res.status === 429) throw new AIError("rate_limited");
    if (res.status === 401 || res.status === 403) throw new AIError("not_configured", "Gemini API key rejected");
    if (!res.ok) throw new AIError("upstream", `Gemini API error ${res.status}`);
    const j = (await res.json()) as GeminiResponse;
    if (j.promptFeedback?.blockReason) throw new AIError("refused");
    const cand = j.candidates?.[0];
    if (cand?.finishReason === "SAFETY" || cand?.finishReason === "PROHIBITED_CONTENT") throw new AIError("refused");
    const text = (cand?.content?.parts || []).map((p) => p.text || "").join("");
    const inputTokens = j.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = j.usageMetadata?.candidatesTokenCount ?? 0;
    return { text, truncated: cand?.finishReason === "MAX_TOKENS", usage: { model, inputTokens, outputTokens, costMicroUsd: costMicroUsd(model, inputTokens, outputTokens) } };
  }

  async generateJSON<S extends z.ZodType>(req: JSONRequest<S>) {
    const { text, usage } = await this.run(req.tier, req.system, req.prompt, req.maxTokens, req.schema);
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { throw new AIError("invalid_json", undefined, usage); }
    const r = req.schema.safeParse(parsed);
    if (!r.success) throw new AIError("invalid_json", undefined, usage);
    return { data: r.data as z.infer<S>, usage };
  }

  async generateText(req: TextRequest) {
    const { text, usage } = await this.run(req.tier, req.system, req.prompt, req.maxTokens);
    return { text: text.trim(), usage };
  }

  async readImages(req: VisionRequest) {
    const { text, usage, truncated } = await this.run(req.tier, req.system, req.prompt, req.maxTokens, undefined, req.images);
    return { text: text.trim(), usage, truncated };
  }
}
