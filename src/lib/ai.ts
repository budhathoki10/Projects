import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

/**
 * Two jobs for Claude: reading (turning a CV or job post into structured data, cheap and fast)
 * and writing (tailoring, cover letters, interview feedback, where quality matters).
 */
const MODELS = {
  read: () => process.env.AI_READ_MODEL || "claude-haiku-5-5",
  write: () => process.env.AI_WRITE_MODEL || "claude-opus-5-5",
};

export function aiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** Claude declined, or returned something that didn't fit the schema. Callers fall back to plain code. */
export class AiUnavailableError extends Error {}

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

/**
 * One request, one validated JSON answer. Writing calls opt into server-side refusal
 * fallbacks, so a rare false-positive decline is retried on another model in the same call.
 */
export async function structured<S extends z.ZodType>(opts: {
  task: "read" | "write";
  system: string;
  prompt: string;
  schema: S;
  maxTokens?: number;
}): Promise<z.infer<S>> {
  if (!aiEnabled()) throw new AiUnavailableError("ANTHROPIC_API_KEY is not set");
  const write = opts.task === "write";
  const response = await anthropic().beta.messages.parse({
    model: write ? MODELS.write() : MODELS.read(),
    max_tokens: opts.maxTokens ?? 16000,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
    output_config: { format: betaZodOutputFormat(opts.schema), effort: write ? "medium" : "low" },
    ...(write ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  });
  if (response.stop_reason === "refusal") throw new AiUnavailableError(`Declined: ${response.stop_details?.category ?? "unknown"}`);
  if (response.stop_reason === "max_tokens") throw new AiUnavailableError("The answer was cut off");
  if (!response.parsed_output) throw new AiUnavailableError("The answer didn't match the expected shape");
  return response.parsed_output as z.infer<S>;
}

/** Wrap user-provided text so the model treats it as material to work on, not instructions. */
export function quoted(label: string, text: string): string {
  return `<${label}>\n${text.replace(new RegExp(`</?${label}>`, "g"), "")}\n</${label}>`;
}
