// Provider-neutral AI interface. Matching never uses AI; only reading and writing steps do.
import type { z } from "zod";

/** fast = extraction, normalisation, tailoring (Claude Haiku). quality = Master CV, cover letter (Claude Sonnet). */
export type AITier = "fast" | "quality";

export type AIFeature = "cv_extract" | "cv_ocr" | "master_cv" | "pack" | "pack_letter" | "paste_job" | "alert_parse" | "roadmap" | "interview" | "cv_edit" | "match_check";

export interface AIUsage { model: string; inputTokens: number; outputTokens: number; costMicroUsd: number }

export interface JSONRequest<S extends z.ZodType> {
  tier: AITier;
  system: string;
  prompt: string;
  schema: S;
  maxTokens?: number;
}
export interface TextRequest { tier: AITier; system: string; prompt: string; maxTokens?: number }

/** One page image (base64, no data: prefix). JPEG from the browser's page renderer in practice. */
export interface PageImage { mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string }
/** Vision request: images first, then the instruction. Returns plain text. */
export interface VisionRequest { tier: AITier; system: string; prompt: string; images: PageImage[]; maxTokens?: number }

export interface AIProvider {
  readonly name: string;
  generateJSON<S extends z.ZodType>(req: JSONRequest<S>): Promise<{ data: z.infer<S>; usage: AIUsage }>;
  generateText(req: TextRequest): Promise<{ text: string; usage: AIUsage }>;
  /** Read text from images (CV photos / scanned pages). */
  readImages(req: VisionRequest): Promise<{ text: string; usage: AIUsage; truncated: boolean }>;
}

export type AIErrorCode = "not_configured" | "over_cap" | "trial_expired" | "plan_expired" | "refused" | "invalid_json" | "rate_limited" | "upstream" | "unresolved";

export class AIError extends Error {
  constructor(public code: AIErrorCode, message?: string, public usage?: AIUsage) {
    super(message || code);
    this.name = "AIError";
  }
}

/** User-facing copy for AI failures (prototype aiErrCopy). */
export function aiErrCopy(e: unknown): string {
  const c = e instanceof AIError ? e.code : "upstream";
  if (c === "not_configured") return "AI analysis is not set up on this server yet. You can still try the sample CV.";
  if (c === "unresolved") return "We are still finishing your previous step. Try again in 3 minutes.";
  if (c === "over_cap") return "You have reached your current AI allowance. See Upgrade for your plan and renewal date; matching and reminders keep working.";
  if (c === "trial_expired") return "Your free trial has ended. Matching keeps working; AI preparation needs Pro (see the Upgrade page).";
  if (c === "plan_expired") return "Your Pro month has ended. Matching keeps working; renew on the Upgrade page to use AI preparation again.";
  if (c === "rate_limited") return "Too many requests right now. Wait a minute and try again.";
  if (c === "invalid_json") return "The analysis came back in an unexpected shape. Try again.";
  if (c === "refused") return "The AI declined this request. Try different text.";
  return "The analysis did not finish. Try again, or use the sample CV.";
}
