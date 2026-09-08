/**
 * Centralized server-side AI gateway.
 *
 * The ONLY place in the application that talks to an AI provider.
 * - credentials stay server-side (GEMINI_API_KEY)
 * - native structured JSON schema enforcement
 * - every response is validated with Zod before it leaves this module
 * - timeouts, bounded retries, provider error normalization, and secret masking
 * - provider-agnostic adapter architecture (Gemini 2.5 Flash + fallback)
 *
 * Nothing here accepts a client-provided system prompt.
 */
import { z } from "zod";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Maintained for backward compatibility
export const DEFAULT_MODEL = DEFAULT_GEMINI_MODEL;
export const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type AiUsage = {
  model: string;
  promptTokens?: number | undefined;
  completionTokens?: number | undefined;
  totalTokens?: number | undefined;
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
  /** Name of the structured operation, used as the tool name or task descriptor. */
  toolName: string;
  toolDescription: string;
  /** JSON schema describing the expected structured payload. */
  jsonSchema: Record<string, unknown>;
  /** Zod schema used to validate the parsed payload. */
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  model?: string;
  temperature?: number;
  timeoutMs?: number;
  maxAttempts?: number;
};

function emptyUsage(model: string, started: number, attempts: number): AiUsage {
  return { model, durationMs: Date.now() - started, attempts };
}

/** Recursively mask sensitive tokens or keys from error strings. */
export function maskSecrets(raw: string, secrets: (string | undefined | null)[]): string {
  let cleaned = raw;
  for (const secret of secrets) {
    if (secret && secret.length > 4) {
      cleaned = cleaned.split(secret).join("[REDACTED]");
    }
  }
  return cleaned;
}

/** Extract a JSON object from raw text, tolerating code fences and prose. */
export function recoverJson(raw: string): unknown | undefined {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
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

/**
 * Clean JSON schema for Google Gemini API.
 * Strips unsupported properties like `$schema` and `additionalProperties` which
 * can cause INVALID_ARGUMENT errors in Gemini v1beta.
 */
export function cleanSchemaForGemini(schema: unknown): unknown {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map(cleanSchemaForGemini);

  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (k === "$schema" || k === "additionalProperties") {
      continue;
    }
    cleaned[k] = cleanSchemaForGemini(v);
  }
  return cleaned;
}

/** Provider adapter interface for modular provider swapping. */
interface ProviderAdapter {
  execute<T>(
    options: AiCallOptions<T>,
    apiKey: string,
    model: string,
    timeoutMs: number,
  ): Promise<
    | {
        ok: true;
        rawText: string;
        promptTokens?: number | undefined;
        completionTokens?: number | undefined;
        totalTokens?: number | undefined;
      }
    | { ok: false; code: AiFailureCode; message: string; retryable: boolean }
  >;
}

/**
 * Direct Google Gemini API adapter.
 * Uses official generateContent endpoint with responseMimeType: "application/json"
 * and responseSchema for native structured output.
 */
class GeminiProviderAdapter implements ProviderAdapter {
  async execute<T>(options: AiCallOptions<T>, apiKey: string, model: string, timeoutMs: number) {
    const baseUrl = process.env["GEMINI_BASE_URL"] || GEMINI_BASE_URL;
    const url = `${baseUrl}/${encodeURIComponent(model)}:generateContent`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const sanitizedSchema = cleanSchemaForGemini(options.jsonSchema);

    const requestBody = {
      system_instruction: {
        parts: [{ text: options.system }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: options.user }],
        },
      ],
      generationConfig: {
        temperature: options.temperature ?? 0.1,
        responseMimeType: "application/json",
        responseSchema: sanitizedSchema,
      },
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      if (response.status === 429) {
        return {
          ok: false as const,
          code: "rate_limited" as const,
          message: "Gemini API rate limit reached. Please retry shortly.",
          retryable: true,
        };
      }

      if (!response.ok) {
        let errorBody: { error?: { message?: string; status?: string } } | undefined;
        try {
          errorBody = (await response.json()) as typeof errorBody;
        } catch {
          /* ignore non-json error */
        }

        const rawMsg =
          errorBody?.error?.message ?? `Gemini provider returned status ${response.status}`;
        const errorMsg = maskSecrets(rawMsg, [apiKey]);

        if (
          response.status === 400 &&
          (errorMsg.includes("API key not valid") || errorMsg.includes("API_KEY_INVALID"))
        ) {
          return {
            ok: false as const,
            code: "provider_error" as const,
            message: "Invalid Gemini API key.",
            retryable: false,
          };
        }

        if (response.status === 403 || errorMsg.includes("PERMISSION_DENIED")) {
          return {
            ok: false as const,
            code: "provider_error" as const,
            message: "Gemini API authentication failed or permission denied.",
            retryable: false,
          };
        }

        if (errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("quota")) {
          return {
            ok: false as const,
            code: "payment_required" as const,
            message: "Gemini API quota exceeded for this account.",
            retryable: false,
          };
        }

        const isTransient = response.status >= 500;
        return {
          ok: false as const,
          code: "provider_error" as const,
          message: errorMsg,
          retryable: isTransient,
        };
      }

      const body = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
          finishReason?: string;
        }>;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        };
      };

      const rawText = body.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        return {
          ok: false as const,
          code: "malformed_response" as const,
          message: "Gemini returned an empty candidate response.",
          retryable: false,
        };
      }

      return {
        ok: true as const,
        rawText,
        promptTokens: body.usageMetadata?.promptTokenCount,
        completionTokens: body.usageMetadata?.candidatesTokenCount,
        totalTokens: body.usageMetadata?.totalTokenCount,
      };
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return {
          ok: false as const,
          code: "timeout" as const,
          message: `Gemini API request timed out after ${timeoutMs}ms.`,
          retryable: true,
        };
      }
      return {
        ok: false as const,
        code: "provider_error" as const,
        message: maskSecrets((error as Error).message, [apiKey]),
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Fallback adapter for OpenAI-compatible gateways (e.g., Lovable AI Gateway).
 * Maintained for backward compatibility with existing tests.
 */
class OpenAiCompatibleAdapter implements ProviderAdapter {
  async execute<T>(options: AiCallOptions<T>, apiKey: string, model: string, timeoutMs: number) {
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
        return {
          ok: false as const,
          code: "rate_limited" as const,
          message: "AI provider rate limit reached. Please retry shortly.",
          retryable: true,
        };
      }
      if (response.status === 402) {
        return {
          ok: false as const,
          code: "payment_required" as const,
          message: "AI credits are exhausted for this workspace.",
          retryable: false,
        };
      }
      if (!response.ok) {
        return {
          ok: false as const,
          code: "provider_error" as const,
          message: `AI provider returned ${response.status}.`,
          retryable: response.status >= 500,
        };
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

      const message = body.choices?.[0]?.message;
      const rawText = message?.tool_calls?.[0]?.function?.arguments ?? message?.content ?? "";

      return {
        ok: true as const,
        rawText,
        promptTokens: body.usage?.prompt_tokens,
        completionTokens: body.usage?.completion_tokens,
        totalTokens: body.usage?.total_tokens,
      };
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return {
          ok: false as const,
          code: "timeout" as const,
          message: `AI request timed out after ${timeoutMs}ms.`,
          retryable: true,
        };
      }
      return {
        ok: false as const,
        code: "provider_error" as const,
        message: maskSecrets((error as Error).message, [apiKey]),
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Main entry point for structured AI calls.
 * Selects the active provider adapter based on available environment credentials.
 */
export async function callStructuredAi<T>(options: AiCallOptions<T>): Promise<AiResult<T>> {
  const started = Date.now();
  const geminiKey = process.env["GEMINI_API_KEY"];
  const fallbackKey = process.env["LOVABLE_API_KEY"];

  if (!geminiKey && !fallbackKey) {
    const model = options.model ?? DEFAULT_GEMINI_MODEL;
    return {
      ok: false,
      code: "not_configured",
      message: "AI is not configured for this environment. Please set GEMINI_API_KEY.",
      usage: emptyUsage(model, started, 0),
    };
  }

  // Choose provider: Gemini has primary precedence
  const isGemini = Boolean(geminiKey);
  const apiKey = (geminiKey || fallbackKey)!;
  const model =
    options.model ??
    (isGemini ? process.env["GEMINI_MODEL"] || DEFAULT_GEMINI_MODEL : DEFAULT_MODEL);
  const adapter: ProviderAdapter = isGemini
    ? new GeminiProviderAdapter()
    : new OpenAiCompatibleAdapter();

  const timeoutMs = options.timeoutMs ?? 90_000;
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);

  let attempts = 0;
  let lastCode: AiFailureCode = "provider_error";
  let lastMessage = "AI request failed.";
  let promptTokens: number | undefined;
  let completionTokens: number | undefined;
  let totalTokens: number | undefined;

  while (attempts < maxAttempts) {
    attempts += 1;

    const result = await adapter.execute(options, apiKey, model, timeoutMs);

    if (!result.ok) {
      lastCode = result.code;
      lastMessage = result.message;

      if (!result.retryable || attempts >= maxAttempts) {
        break;
      }
      // Bounded backoff retry for transient network/rate issues
      await new Promise((r) => setTimeout(r, Math.min(2000, 500 * Math.pow(2, attempts - 1))));
      continue;
    }

    promptTokens = result.promptTokens;
    completionTokens = result.completionTokens;
    totalTokens = result.totalTokens;

    const payload = recoverJson(result.rawText);
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
