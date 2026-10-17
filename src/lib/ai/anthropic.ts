// Anthropic Claude adapter (official @anthropic-ai/sdk). Server-only: reads ANTHROPIC_API_KEY.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { AIError, type AIProvider, type AITier, type JSONRequest, type TextRequest, type VisionRequest } from "./provider";
import { costMicroUsd } from "./pricing";

export const MODELS: Record<AITier, string> = {
  fast: process.env.AI_MODEL_FAST || "claude-haiku-5-5",
  quality: process.env.AI_MODEL_QUALITY || "claude-sonnet-5-5",
};

// Server-side refusal fallback is supported on Sonnet (not Haiku) on the Claude API.
const supportsFallback = (model: string) => model.startsWith("claude-sonnet") || model.startsWith("claude-opus");

function mapError(e: unknown): never {
  if (e instanceof AIError) throw e;
  if (e instanceof Anthropic.RateLimitError) throw new AIError("rate_limited");
  if (e instanceof Anthropic.AuthenticationError) throw new AIError("not_configured", "Anthropic API key rejected");
  if (e instanceof Anthropic.APIError) throw new AIError("upstream", `Anthropic API error ${e.status}`);
  throw new AIError("upstream", e instanceof Error ? e.message : String(e));
}

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
  }

  private base(tier: AITier, maxTokens: number | undefined) {
    const model = MODELS[tier];
    return {
      model,
      max_tokens: maxTokens ?? 16000,
      ...(supportsFallback(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    };
  }

  async generateJSON<S extends z.ZodType>(req: JSONRequest<S>) {
    const b = this.base(req.tier, req.maxTokens);
    try {
      const res = await this.client.beta.messages.parse({
        ...b,
        system: req.system,
        messages: [{ role: "user", content: req.prompt }],
        output_config: { effort: req.tier === "fast" ? "low" : "medium", format: betaZodOutputFormat(req.schema) },
      });
      if (res.stop_reason === "refusal") throw new AIError("refused");
      if (res.stop_reason === "max_tokens" || res.parsed_output == null) throw new AIError("invalid_json");
      const usage = { model: res.model || b.model, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens, costMicroUsd: costMicroUsd(b.model, res.usage.input_tokens, res.usage.output_tokens) };
      return { data: res.parsed_output as z.infer<S>, usage };
    } catch (e) {
      mapError(e);
    }
  }

  async generateText(req: TextRequest) {
    const b = this.base(req.tier, req.maxTokens);
    try {
      const res = await this.client.beta.messages.create({
        ...b,
        system: req.system,
        messages: [{ role: "user", content: req.prompt }],
        output_config: { effort: "low" },
      });
      if (res.stop_reason === "refusal") throw new AIError("refused");
      const text = res.content.map((c) => (c.type === "text" ? c.text : "")).join("").trim();
      const usage = { model: res.model || b.model, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens, costMicroUsd: costMicroUsd(b.model, res.usage.input_tokens, res.usage.output_tokens) };
      return { text, usage };
    } catch (e) {
      mapError(e);
    }
  }

  async readImages(req: VisionRequest) {
    const b = this.base(req.tier, req.maxTokens);
    try {
      const res = await this.client.beta.messages.create({
        ...b,
        system: req.system,
        messages: [{
          role: "user",
          content: [
            ...req.images.map((img) => ({ type: "image" as const, source: { type: "base64" as const, media_type: img.mediaType, data: img.data } })),
            { type: "text" as const, text: req.prompt },
          ],
        }],
        output_config: { effort: "low" },
      });
      if (res.stop_reason === "refusal") throw new AIError("refused");
      const text = res.content.map((c) => (c.type === "text" ? c.text : "")).join("").trim();
      const usage = { model: res.model || b.model, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens, costMicroUsd: costMicroUsd(b.model, res.usage.input_tokens, res.usage.output_tokens) };
      return { text, usage, truncated: res.stop_reason === "max_tokens" };
    } catch (e) {
      mapError(e);
    }
  }
}
