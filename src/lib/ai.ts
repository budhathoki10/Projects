import "server-only";
import { z } from "zod";

/**
 * Two jobs for the model: reading (turning a CV or job post into structured data, cheap and
 * fast) and writing (tailoring, cover letters, interview feedback, where quality matters).
 * Both go through OpenRouter's OpenAI-compatible chat API, so any model it hosts will do.
 */
const MODELS = {
  read: () => process.env.AI_READ_MODEL || "openrouter/free",
  write: () => process.env.AI_WRITE_MODEL || "openrouter/free",
};

const baseUrl = () => (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");

export function aiEnabled(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

/** The model declined, was cut off, or returned something that didn't fit the schema. Callers fall back to plain code. */
export class AiUnavailableError extends Error {}

type ChatResponse = {
  choices?: { finish_reason?: string | null; message?: { content?: string | null; refusal?: string | null } }[];
  error?: { message?: string; code?: number | string };
};

/** Models sometimes wrap JSON in a code fence even when told not to. */
function jsonFrom(content: string): unknown {
  const body = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(body);
}

/**
 * One request, one validated JSON answer. The reply is constrained to the schema by the
 * provider, then checked against it again here: nothing the model returns is trusted until
 * it has passed `schema`.
 */
export async function structured<S extends z.ZodType>(opts: {
  task: "read" | "write";
  system: string;
  prompt: string;
  schema: S;
  maxTokens?: number;
}): Promise<z.infer<S>> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new AiUnavailableError("OPENROUTER_API_KEY is not set");

  const jsonSchema = z.toJSONSchema(opts.schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  const res = await fetch(`${baseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      // Optional attribution headers OpenRouter shows on its dashboards.
      "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
      "X-Title": "Shortlist",
    },
    body: JSON.stringify({
      model: opts.task === "write" ? MODELS.write() : MODELS.read(),
      max_tokens: opts.maxTokens ?? 8000,
      temperature: opts.task === "write" ? 0.4 : 0,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.prompt },
      ],
      response_format: { type: "json_schema", json_schema: { name: "result", strict: true, schema: jsonSchema } },
      // Only route to providers that honour the schema, and never to ones that keep prompts or train on them: the prompts hold people's CVs.
      provider: { require_parameters: true, data_collection: "deny" },
    }),
    signal: AbortSignal.timeout(90_000),
  });

  const data = (await res.json().catch(() => ({}))) as ChatResponse;
  // Never include the response body in the error: it can echo prompt text, which holds the user's CV.
  if (!res.ok) throw new Error(`OpenRouter request failed (${res.status}${data.error?.code ? `, ${data.error.code}` : ""})`);
  if (data.error) throw new Error(`OpenRouter error (${data.error.code ?? "unknown"})`);

  const choice = data.choices?.[0];
  if (choice?.message?.refusal) throw new AiUnavailableError("The model declined");
  if (choice?.finish_reason === "length") throw new AiUnavailableError("The answer was cut off");
  const content = choice?.message?.content;
  if (!content) throw new AiUnavailableError("The model returned nothing");

  let raw: unknown;
  try {
    raw = jsonFrom(content);
  } catch {
    throw new AiUnavailableError("The answer wasn't valid JSON");
  }
  const parsed = opts.schema.safeParse(raw);
  if (!parsed.success) throw new AiUnavailableError("The answer didn't match the expected shape");
  return parsed.data;
}

/** Wrap user-provided text so the model treats it as material to work on, not instructions. */
export function quoted(label: string, text: string): string {
  return `<${label}>\n${text.replace(new RegExp(`</?${label}>`, "gi"), "")}\n</${label}>`;
}
