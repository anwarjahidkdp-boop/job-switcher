// Optional Google Gemini adapter (official @google/genai). Enabled with AI_PROVIDER=gemini + GEMINI_API_KEY.
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { AIError, type AIProvider, type AITier, type JSONRequest, type TextRequest } from "./provider";
import { costMicroUsd } from "./pricing";

const MODELS: Record<AITier, string> = {
  fast: process.env.GEMINI_MODEL_FAST || "gemini-2.5-flash",
  quality: process.env.GEMINI_MODEL_QUALITY || "gemini-2.5-pro",
};

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  private ai: GoogleGenAI;
  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  private async run(tier: AITier, system: string, prompt: string, maxTokens: number | undefined, schema?: z.ZodType) {
    const model = MODELS[tier];
    try {
      const res = await this.ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: system,
          maxOutputTokens: maxTokens ?? 16000,
          ...(schema ? { responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(schema) } : {}),
        },
      });
      const inputTokens = res.usageMetadata?.promptTokenCount ?? 0;
      const outputTokens = res.usageMetadata?.candidatesTokenCount ?? 0;
      return { text: res.text ?? "", usage: { model, inputTokens, outputTokens, costMicroUsd: costMicroUsd(model, inputTokens, outputTokens) } };
    } catch (e) {
      throw new AIError("upstream", e instanceof Error ? e.message : String(e));
    }
  }

  async generateJSON<S extends z.ZodType>(req: JSONRequest<S>) {
    const { text, usage } = await this.run(req.tier, req.system, req.prompt, req.maxTokens, req.schema);
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { throw new AIError("invalid_json"); }
    const r = req.schema.safeParse(parsed);
    if (!r.success) throw new AIError("invalid_json");
    return { data: r.data as z.infer<S>, usage };
  }

  async generateText(req: TextRequest) {
    return this.run(req.tier, req.system, req.prompt, req.maxTokens);
  }
}
