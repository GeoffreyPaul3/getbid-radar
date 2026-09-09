/**
 * Centralized server-side AI gateway for GetBidRadar.
 *
 * THE ONLY place in the application that talks to an AI provider.
 *
 * Provider cascade (attempted in order, failing-over on rate_limited / payment_required / timeout):
 *   1. Google Gemini 2.5 Flash   — GEMINI_API_KEY (native structured JSON output)
 *   2. Groq                      — GROQ_API_KEY   (llama-3.3-70b-versatile, tool_calls)
 *   3. OpenRouter                — OPENROUTER_API_KEY (google/gemini-2.5-flash, JSON mode)
 *
 * Guarantees:
 *   - All credentials stay server-side — never exposed to client bundles.
 *   - Every response is Zod-validated before it leaves this module.
 *   - Secret masking applied to all error strings.
 *   - Deterministic scoring engine is the sole authority for BID/REVIEW/NO-BID.
 *     Providers perform qualitative assessment only.
 *   - No client-provided system prompt is ever accepted.
 */
import { z } from "zod";
import { ensureServerEnv } from "../server-env";

// ──────────────────────────────────────────────────────────────
// Provider constants
// ──────────────────────────────────────────────────────────────

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions";

export const DEFAULT_OPENROUTER_MODEL = "google/gemini-2.5-flash";
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

/** @deprecated Alias kept so existing imports don't break. Use GEMINI_BASE_URL. */
export const DEFAULT_MODEL = DEFAULT_GEMINI_MODEL;

// ──────────────────────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────────────────────

export type AiUsage = {
  model: string;
  activeProvider: "gemini" | "groq" | "openrouter";
  promptTokens?: number | undefined;
  completionTokens?: number | undefined;
  totalTokens?: number | undefined;
  durationMs: number;
  attempts: number;
};

export type AiFailureCode =
  | "not_configured"
  | "authentication_failed"
  | "timeout"
  | "provider_error"
  | "provider_unavailable"
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

// ──────────────────────────────────────────────────────────────
// Utility helpers
// ──────────────────────────────────────────────────────────────

function emptyUsage(
  model: string,
  provider: AiUsage["activeProvider"],
  started: number,
  attempts: number,
): AiUsage {
  return { model, activeProvider: provider, durationMs: Date.now() - started, attempts };
}

/** Recursively mask sensitive tokens from error strings. */
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
 * cause INVALID_ARGUMENT errors in Gemini v1beta.
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

// ──────────────────────────────────────────────────────────────
// Provider adapter interface
// ──────────────────────────────────────────────────────────────

type ProviderAdapterResult =
  | {
      ok: true;
      rawText: string;
      promptTokens?: number | undefined;
      completionTokens?: number | undefined;
      totalTokens?: number | undefined;
    }
  | { ok: false; code: AiFailureCode; message: string; retryable: boolean };

interface ProviderAdapter {
  readonly name: AiUsage["activeProvider"];
  execute<T>(
    options: AiCallOptions<T>,
    apiKey: string,
    model: string,
    timeoutMs: number,
  ): Promise<ProviderAdapterResult>;
}

// ──────────────────────────────────────────────────────────────
// 1. Google Gemini 2.5 Flash
// ──────────────────────────────────────────────────────────────

class GeminiProviderAdapter implements ProviderAdapter {
  readonly name = "gemini" as const;

  async execute<T>(options: AiCallOptions<T>, apiKey: string, model: string, timeoutMs: number) {
    const baseUrl = process.env["GEMINI_BASE_URL"] || GEMINI_BASE_URL;
    const url = `${baseUrl}/${encodeURIComponent(model)}:generateContent`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const sanitizedSchema = cleanSchemaForGemini(options.jsonSchema);

    const requestBody = {
      system_instruction: { parts: [{ text: options.system }] },
      contents: [{ role: "user", parts: [{ text: options.user }] }],
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
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(requestBody),
      });

      if (response.status === 429) {
        return {
          ok: false as const,
          code: "rate_limited" as const,
          message: "Gemini API rate limit reached.",
          retryable: false,
        };
      }

      if (response.status === 503) {
        return {
          ok: false as const,
          code: "provider_unavailable" as const,
          message: "Gemini API service is temporarily unavailable.",
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
        const rawMsg = errorBody?.error?.message ?? `Gemini returned status ${response.status}`;
        const errorMsg = maskSecrets(rawMsg, [apiKey]);

        if (
          (response.status === 400 &&
            (errorMsg.includes("API key not valid") || errorMsg.includes("API_KEY_INVALID"))) ||
          response.status === 401 ||
          response.status === 403 ||
          errorMsg.includes("PERMISSION_DENIED")
        ) {
          return {
            ok: false as const,
            code: "authentication_failed" as const,
            message: "Invalid Gemini API key or permission denied.",
            retryable: false,
          };
        }
        if (errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("quota")) {
          return {
            ok: false as const,
            code: "payment_required" as const,
            message: "Gemini API quota exceeded.",
            retryable: false,
          };
        }
        return {
          ok: false as const,
          code:
            response.status === 503
              ? ("provider_unavailable" as const)
              : ("provider_error" as const),
          message: errorMsg,
          retryable: response.status >= 500,
        };
      }

      const body = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
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
          retryable: false,
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

// ──────────────────────────────────────────────────────────────
// 2. Groq (OpenAI-compatible, tool_calls structured output)
// ──────────────────────────────────────────────────────────────

class GroqProviderAdapter implements ProviderAdapter {
  readonly name = "groq" as const;

  async execute<T>(options: AiCallOptions<T>, apiKey: string, model: string, timeoutMs: number) {
    const url = process.env["GROQ_BASE_URL"] || GROQ_BASE_URL;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
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
          message: "Groq rate limit reached.",
          retryable: false,
        };
      }
      if (response.status === 401 || response.status === 403) {
        return {
          ok: false as const,
          code: "authentication_failed" as const,
          message: "Groq API authentication failed.",
          retryable: false,
        };
      }
      if (response.status === 402) {
        return {
          ok: false as const,
          code: "payment_required" as const,
          message: "Groq credits exhausted.",
          retryable: false,
        };
      }
      if (response.status === 503) {
        return {
          ok: false as const,
          code: "provider_unavailable" as const,
          message: "Groq service is temporarily unavailable.",
          retryable: true,
        };
      }
      if (!response.ok) {
        let errorMsg = `Groq returned status ${response.status}`;
        try {
          const errBody = (await response.json()) as { error?: { message?: string } };
          if (errBody?.error?.message) {
            errorMsg = maskSecrets(errBody.error.message, [apiKey]);
          }
        } catch {
          /* ignore */
        }
        return {
          ok: false as const,
          code:
            response.status >= 500
              ? ("provider_unavailable" as const)
              : ("provider_error" as const),
          message: errorMsg,
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
          message: `Groq request timed out after ${timeoutMs}ms.`,
          retryable: false,
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

// ──────────────────────────────────────────────────────────────
// 3. OpenRouter (OpenAI-compatible, JSON response_format)
// ──────────────────────────────────────────────────────────────

class OpenRouterProviderAdapter implements ProviderAdapter {
  readonly name = "openrouter" as const;

  async execute<T>(options: AiCallOptions<T>, apiKey: string, model: string, timeoutMs: number) {
    const url = process.env["OPENROUTER_BASE_URL"] || OPENROUTER_BASE_URL;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://getbidradar.com",
          "X-Title": "GetBidRadar",
        },
        body: JSON.stringify({
          model,
          temperature: options.temperature ?? 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `${options.system}\n\nYou MUST respond with valid JSON matching this schema:\n${JSON.stringify(options.jsonSchema, null, 2)}`,
            },
            { role: "user", content: options.user },
          ],
        }),
      });

      if (response.status === 429) {
        return {
          ok: false as const,
          code: "rate_limited" as const,
          message: "OpenRouter rate limit reached.",
          retryable: false,
        };
      }
      if (response.status === 401 || response.status === 403) {
        return {
          ok: false as const,
          code: "authentication_failed" as const,
          message: "OpenRouter authentication failed.",
          retryable: false,
        };
      }
      if (response.status === 402) {
        return {
          ok: false as const,
          code: "payment_required" as const,
          message: "OpenRouter credits exhausted.",
          retryable: false,
        };
      }
      if (response.status === 503) {
        return {
          ok: false as const,
          code: "provider_unavailable" as const,
          message: "OpenRouter service is temporarily unavailable.",
          retryable: true,
        };
      }
      if (!response.ok) {
        let errorMsg = `OpenRouter returned status ${response.status}`;
        try {
          const errBody = (await response.json()) as { error?: { message?: string } };
          if (errBody?.error?.message) {
            errorMsg = maskSecrets(errBody.error.message, [apiKey]);
          }
        } catch {
          /* ignore */
        }
        return {
          ok: false as const,
          code:
            response.status >= 500
              ? ("provider_unavailable" as const)
              : ("provider_error" as const),
          message: errorMsg,
          retryable: response.status >= 500,
        };
      }

      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };

      const rawText = body.choices?.[0]?.message?.content ?? "";

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
          message: `OpenRouter request timed out after ${timeoutMs}ms.`,
          retryable: false,
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

// ──────────────────────────────────────────────────────────────
// Provider cascade configuration
// ──────────────────────────────────────────────────────────────

type ProviderConfig = {
  adapter: ProviderAdapter;
  apiKey: string;
  model: string;
};

/**
 * Codes that signal provider exhaustion — trigger cascade to next provider.
 * Codes like validation_failed / malformed_response are content problems and
 * do NOT cascade to another provider (they retry within the same provider).
 */
const CASCADE_CODES = new Set<AiFailureCode>([
  "rate_limited",
  "payment_required",
  "timeout",
  "provider_unavailable",
  "authentication_failed",
]);

/**
 * Build the ordered list of available providers from environment.
 * Provider is excluded if its key is absent or empty.
 */
function buildProviderCascade(modelOverride?: string): ProviderConfig[] {
  ensureServerEnv();
  const providers: ProviderConfig[] = [];

  const geminiKey = process.env["GEMINI_API_KEY"];
  if (geminiKey) {
    providers.push({
      adapter: new GeminiProviderAdapter(),
      apiKey: geminiKey,
      model: modelOverride ?? process.env["GEMINI_MODEL"] ?? DEFAULT_GEMINI_MODEL,
    });
  }

  const groqKey = process.env["GROQ_API_KEY"];
  if (groqKey) {
    providers.push({
      adapter: new GroqProviderAdapter(),
      apiKey: groqKey,
      model: process.env["GROQ_MODEL"] ?? DEFAULT_GROQ_MODEL,
    });
  }

  const openrouterKey = process.env["OPENROUTER_API_KEY"];
  if (openrouterKey) {
    providers.push({
      adapter: new OpenRouterProviderAdapter(),
      apiKey: openrouterKey,
      model: process.env["OPENROUTER_MODEL"] ?? DEFAULT_OPENROUTER_MODEL,
    });
  }

  return providers;
}

// ──────────────────────────────────────────────────────────────
// Main entry point
// ──────────────────────────────────────────────────────────────

/**
 * Execute a structured AI call through the provider cascade.
 *
 * Tries Gemini → Groq → OpenRouter in order.
 * Cascades to the next provider on rate_limited, payment_required, or timeout.
 * Retries within the same provider on transient 5xx or network errors (bounded backoff).
 * Never cascades on validation_failed or malformed_response — those are content issues.
 */
export async function callStructuredAi<T>(options: AiCallOptions<T>): Promise<AiResult<T>> {
  const started = Date.now();
  const cascade = buildProviderCascade(options.model);

  if (cascade.length === 0) {
    return {
      ok: false,
      code: "not_configured",
      message:
        "AI is not configured for this environment. Please set GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY.",
      usage: emptyUsage(DEFAULT_GEMINI_MODEL, "gemini", started, 0),
    };
  }

  const timeoutMs = options.timeoutMs ?? 90_000;
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);

  let lastCode: AiFailureCode = "provider_error";
  let lastMessage = "AI request failed.";
  let lastProvider: AiUsage["activeProvider"] = cascade[0]!.adapter.name;
  let lastModel = cascade[0]!.model;
  let totalAttempts = 0;

  for (const { adapter, apiKey, model } of cascade) {
    lastProvider = adapter.name;
    lastModel = model;

    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts += 1;
      totalAttempts += 1;

      const result = await adapter.execute(options, apiKey, model, timeoutMs);

      if (!result.ok) {
        lastCode = result.code;
        lastMessage = result.message;

        // Cascade codes: skip remaining attempts for this provider, try next
        if (CASCADE_CODES.has(result.code)) {
          break;
        }

        // Non-retryable provider errors: stop this provider immediately
        if (!result.retryable || attempts >= maxAttempts) {
          break;
        }

        // Bounded backoff for transient errors within a provider
        await new Promise((r) => setTimeout(r, Math.min(2000, 500 * Math.pow(2, attempts - 1))));
        continue;
      }

      // Provider returned text — validate it
      const payload = recoverJson(result.rawText);
      if (payload === undefined) {
        lastCode = "malformed_response";
        lastMessage = "The AI response could not be parsed as structured data.";
        // Retry within the same provider (content issue, not provider issue)
        if (attempts >= maxAttempts) break;
        continue;
      }

      const parsed = options.schema.safeParse(payload);
      if (!parsed.success) {
        lastCode = "validation_failed";
        lastMessage = `The AI response did not match the expected schema: ${parsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`;
        // Retry within the same provider (content issue, not provider issue)
        if (attempts >= maxAttempts) break;
        continue;
      }

      return {
        ok: true,
        data: parsed.data,
        usage: {
          model,
          activeProvider: adapter.name,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
          durationMs: Date.now() - started,
          attempts: totalAttempts,
        },
      };
    }

    // Only cascade to the next provider if the failure was a capacity/quota/timeout code
    if (!CASCADE_CODES.has(lastCode)) {
      break;
    }
  }

  return {
    ok: false,
    code: lastCode,
    message: lastMessage,
    usage: emptyUsage(lastModel, lastProvider, started, totalAttempts),
  };
}
