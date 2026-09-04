/**
 * Centralized server-side AI gateway.
 *
 * The ONLY place in the application that talks to an AI provider.
 * - credentials stay server-side (LOVABLE_API_KEY)
 * - all calls are structured: the model must answer through a tool schema
 * - every response is validated with Zod before it leaves this module
 * - timeouts, retries, provider errors and malformed output are explicit
 *
 * Nothing here accepts a client-provided system prompt.
 */
import { z } from "zod";

export const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
export const DEFAULT_MODEL = "google/gemini-2.5-flash";

export type AiUsage = {
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  durationMs: number;
  attempts: number;
};

export type AiFailureCode =
  | "not_configured"
  | "timeout"
  | "provider_error"
  | "rate_limited"
  | "payment_required"
  | "malformed_response"
  | "validation_failed";

export type AiResult<T> =
  | { ok: true; data: T; usage: AiUsage }
  | { ok: false; code: AiFailureCode; message: string; usage: AiUsage };

export type AiCallOptions<T> = {
  /** Trusted system instructions. Never derived from user documents. */
  system: string;
  /** Message content. Untrusted document text must already be wrapped/delimited. */
  user: string;
  /** Name of the structured operation, used as the tool name. */
  toolName: string;
  toolDescription: string;
  /** JSON schema describing the expected structured payload. */
  jsonSchema: Record<string, unknown>;
  /** Zod schema used to validate the parsed payload. */
  schema: z.ZodType<T>;
  model?: string;
  temperature?: number;
  timeoutMs?: number;
  maxAttempts?: number;
};

function emptyUsage(model: string, started: number, attempts: number): AiUsage {
  return { model, durationMs: Date.now() - started, attempts };
}

/** Extract a JSON object from raw text, tolerating code fences and prose. */
export function recoverJson(raw: string): unknown | undefined {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export async function callStructuredAi<T>(options: AiCallOptions<T>): Promise<AiResult<T>> {
  const model = options.model ?? DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs ?? 90_000;
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const started = Date.now();

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    return {
      ok: false,
      code: "not_configured",
      message: "AI is not configured for this environment.",
      usage: emptyUsage(model, started, 0),
    };
  }

  let attempts = 0;
  let lastCode: AiFailureCode = "provider_error";
  let lastMessage = "AI request failed.";
  let promptTokens: number | undefined;
  let completionTokens: number | undefined;
  let totalTokens: number | undefined;

  while (attempts < maxAttempts) {
    attempts += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(AI_GATEWAY_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: options.temperature ?? 0,
          messages: [
            { role: "system", content: options.system },
            { role: "user", content: options.user },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: options.toolName,
                description: options.toolDescription,
                parameters: options.jsonSchema,
              },
            },
          ],
          tool_choice: { type: "function", function: { name: options.toolName } },
        }),
      });

      if (response.status === 429) {
        lastCode = "rate_limited";
        lastMessage = "AI provider rate limit reached. Please retry shortly.";
        await new Promise((r) => setTimeout(r, 800 * attempts));
        continue;
      }
      if (response.status === 402) {
        return {
          ok: false,
          code: "payment_required",
          message: "AI credits are exhausted for this workspace.",
          usage: emptyUsage(model, started, attempts),
        };
      }
      if (!response.ok) {
        lastCode = "provider_error";
        lastMessage = `AI provider returned ${response.status}.`;
        continue;
      }

      const body = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string | null;
            tool_calls?: Array<{ function?: { arguments?: string } }>;
          };
        }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };
      promptTokens = body.usage?.prompt_tokens;
      completionTokens = body.usage?.completion_tokens;
      totalTokens = body.usage?.total_tokens;

      const message = body.choices?.[0]?.message;
      const rawArgs = message?.tool_calls?.[0]?.function?.arguments;
      const payload =
        rawArgs !== undefined
          ? recoverJson(rawArgs)
          : message?.content
            ? recoverJson(message.content)
            : undefined;

      if (payload === undefined) {
        lastCode = "malformed_response";
        lastMessage = "The AI response could not be parsed as structured data.";
        continue;
      }

      const parsed = options.schema.safeParse(payload);
      if (!parsed.success) {
        lastCode = "validation_failed";
        lastMessage = `The AI response did not match the expected schema: ${parsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`;
        continue;
      }

      return {
        ok: true,
        data: parsed.data,
        usage: {
          model,
          promptTokens,
          completionTokens,
          totalTokens,
          durationMs: Date.now() - started,
          attempts,
        },
      };
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        lastCode = "timeout";
        lastMessage = `AI request timed out after ${timeoutMs}ms.`;
      } else {
        lastCode = "provider_error";
        lastMessage = `AI request failed: ${(error as Error).message}`;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ok: false,
    code: lastCode,
    message: lastMessage,
    usage: {
      model,
      promptTokens,
      completionTokens,
      totalTokens,
      durationMs: Date.now() - started,
      attempts,
    },
  };
}
