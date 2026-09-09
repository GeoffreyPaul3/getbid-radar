/**
 * Centralized server-side AI gateway for GetBidRadar.
 *
 * THE ONLY place in the application that talks to an AI provider.
 *
 * Provider cascade (attempted in order, failing over on transient rate_limited / 5xx / timeout):
 *   1. Qwen / DashScope (Primary)    — DASHSCOPE_API_KEY (qwen-plus, OpenAI-compatible)
 *   2. Google Gemini (Fallback 1)     — GEMINI_API_KEY    (gemini-3.5-flash, native structured JSON)
 *   3. Groq (Fallback 2)             — GROQ_API_KEY      (qwen/qwen3.8-27b, tool_calls)
 *   4. OpenRouter (Fallback 3)       — OPENROUTER_API_KEY(nvidia/nemotron-3-super-120b-a12b:free, JSON mode)
 *
 * Guarantees:
 *   - All credentials stay server-side — never exposed to client bundles.
 *   - Every response is Zod-validated before it leaves this module.
 *   - Secret masking applied to all error strings and logs.
 *   - Deterministic scoring engine is the sole authority for BID/REVIEW/NO-BID.
 *     Providers perform qualitative assessment and requirement interpretation only.
 *   - No client-provided system prompt is ever accepted.
 */
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { ensureServerEnv } from "../server-env";
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_MODELS,
  DEFAULT_GROQ_MODEL,
  DEFAULT_GROQ_MODELS,
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_OPENROUTER_MODELS,
  DEFAULT_QWEN_MODEL,
  DEFAULT_QWEN_MODELS,
  GEMINI_BASE_URL,
  GROQ_BASE_URL,
  OPENROUTER_BASE_URL,
  QWEN_BASE_URL,
  assertValidModelId,
  getProviderModelPool,
  type ProviderId,
} from "./registry.server";

// Re-export constants for backward compatibility
export {
  DEFAULT_QWEN_MODEL,
  DEFAULT_QWEN_MODELS,
  QWEN_BASE_URL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_MODELS,
  GEMINI_BASE_URL,
  DEFAULT_GROQ_MODEL,
  DEFAULT_GROQ_MODELS,
  GROQ_BASE_URL,
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_OPENROUTER_MODELS,
  OPENROUTER_BASE_URL,
};

/** @deprecated Alias kept so existing imports don't break. Use DEFAULT_QWEN_MODEL or DEFAULT_GEMINI_MODEL. */
export const DEFAULT_MODEL = DEFAULT_QWEN_MODEL;

/**
 * Returns the centralized Gemini model pool.
 */
export function getGeminiModelPool(preferredModel?: string): string[] {
  return getProviderModelPool("gemini", preferredModel);
}

// ──────────────────────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────────────────────

export type AiUsage = {
  model: string;
  activeProvider: ProviderId;
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

/** Recursively mask sensitive tokens from error strings and logs. */
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
 * Dedicated Gemini-compatible schema conversion layer.
 * Converts JSON Schema (Draft 7 / 2020-12 / Zod-generated) into the strict
 * OpenAPI 3.0 / Protobuf Schema subset accepted by Google's Gemini API.
 */
export function toGeminiSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);

  const raw = schema as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  let isNullable = raw["nullable"] === true;
  let type = raw["type"];

  if (Array.isArray(type)) {
    if (type.includes("null")) {
      isNullable = true;
    }
    const nonNullType = type.find((t) => t !== "null");
    type = typeof nonNullType === "string" ? nonNullType : "string";
  }

  if (typeof type === "string") {
    const upper = type.toUpperCase();
    if (["STRING", "NUMBER", "INTEGER", "BOOLEAN", "ARRAY", "OBJECT"].includes(upper)) {
      out["type"] = upper;
    } else {
      out["type"] = "STRING";
    }
  }

  if (isNullable) {
    out["nullable"] = true;
  }

  if (typeof raw["description"] === "string" && raw["description"].trim()) {
    out["description"] = raw["description"].trim();
  }

  if (Array.isArray(raw["enum"])) {
    out["enum"] = raw["enum"].map(String);
    if (!out["type"]) {
      out["type"] = "STRING";
    }
  }

  if (
    raw["properties"] &&
    typeof raw["properties"] === "object" &&
    !Array.isArray(raw["properties"])
  ) {
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw["properties"] as Record<string, unknown>)) {
      props[k] = toGeminiSchema(v);
    }
    out["properties"] = props;
  }

  if (raw["items"] && typeof raw["items"] === "object") {
    out["items"] = toGeminiSchema(raw["items"]);
  }

  if (Array.isArray(raw["required"])) {
    out["required"] = raw["required"].filter((r): r is string => typeof r === "string");
  }

  return out;
}

export function validateGeminiSchema(
  schema: unknown,
  path = "schema",
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!schema || typeof schema !== "object") {
    errors.push(`${path}: must be an object`);
    return { valid: false, errors };
  }

  const s = schema as Record<string, unknown>;
  if (Array.isArray(s["type"])) {
    errors.push(
      `${path}.type: Proto field is not repeating, cannot be an array: ${JSON.stringify(s["type"])}`,
    );
  }

  const validTypes = ["STRING", "NUMBER", "INTEGER", "BOOLEAN", "ARRAY", "OBJECT"];
  if (typeof s["type"] === "string" && !validTypes.includes(s["type"])) {
    errors.push(
      `${path}.type: Unknown type "${s["type"]}", must be one of ${validTypes.join(", ")}`,
    );
  }

  if (s["properties"]) {
    if (typeof s["properties"] !== "object" || Array.isArray(s["properties"])) {
      errors.push(`${path}.properties: must be a key-value object`);
    } else {
      for (const [k, v] of Object.entries(s["properties"] as Record<string, unknown>)) {
        const sub = validateGeminiSchema(v, `${path}.properties.${k}`);
        if (!sub.valid) errors.push(...sub.errors);
      }
    }
  }

  if (s["items"]) {
    const sub = validateGeminiSchema(s["items"], `${path}.items`);
    if (!sub.valid) errors.push(...sub.errors);
  }

  return { valid: errors.length === 0, errors };
}

export function cleanSchemaForGemini(schema: unknown): unknown {
  return toGeminiSchema(schema);
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
  readonly name: ProviderId;
  execute<T>(
    options: AiCallOptions<T>,
    apiKey: string,
    model: string,
    timeoutMs: number,
  ): Promise<ProviderAdapterResult>;
}

// ──────────────────────────────────────────────────────────────
// 1. Qwen / DashScope (Primary — OpenAI-compatible tool_calls)
// ──────────────────────────────────────────────────────────────

class QwenProviderAdapter implements ProviderAdapter {
  readonly name = "qwen" as const;

  async execute<T>(
    options: AiCallOptions<T>,
    apiKey: string,
    model: string,
    timeoutMs: number,
  ): Promise<ProviderAdapterResult> {
    assertValidModelId(model);
    const url = process.env["DASHSCOPE_BASE_URL"] || QWEN_BASE_URL;
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
          ok: false,
          code: "rate_limited",
          message: "Qwen / DashScope rate limit reached.",
          retryable: false,
        };
      }
      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          code: "authentication_failed",
          message: "Qwen / DashScope API authentication failed.",
          retryable: false,
        };
      }
      if (response.status === 402) {
        return {
          ok: false,
          code: "payment_required",
          message: "Qwen / DashScope credits exhausted.",
          retryable: false,
        };
      }
      if (response.status === 503 || response.status === 502) {
        return {
          ok: false,
          code: "provider_unavailable",
          message: "Qwen / DashScope service is temporarily unavailable or overloaded.",
          retryable: true,
        };
      }
      if (!response.ok) {
        let errorMsg = `Qwen / DashScope returned status ${response.status}`;
        try {
          const errBody = (await response.json()) as { error?: { message?: string } };
          if (errBody?.error?.message) {
            errorMsg = maskSecrets(errBody.error.message, [apiKey]);
          }
        } catch {
          /* ignore */
        }
        return {
          ok: false,
          code: response.status >= 500 ? "provider_unavailable" : "provider_error",
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
        ok: true,
        rawText,
        promptTokens: body.usage?.prompt_tokens,
        completionTokens: body.usage?.completion_tokens,
        totalTokens: body.usage?.total_tokens,
      };
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return {
          ok: false,
          code: "timeout",
          message: `Qwen request timed out after ${timeoutMs}ms.`,
          retryable: false,
        };
      }
      return {
        ok: false,
        code: "provider_error",
        message: maskSecrets((error as Error).message, [apiKey]),
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

// ──────────────────────────────────────────────────────────────
// 2. Google Gemini (Fallback 1 — @google/genai SDK)
// ──────────────────────────────────────────────────────────────

class GeminiProviderAdapter implements ProviderAdapter {
  readonly name = "gemini" as const;

  async execute<T>(
    options: AiCallOptions<T>,
    apiKey: string,
    preferredModel: string,
    timeoutMs: number,
  ): Promise<ProviderAdapterResult> {
    assertValidModelId(preferredModel);
    const sanitizedSchema = toGeminiSchema(options.jsonSchema);
    const schemaValidation = validateGeminiSchema(sanitizedSchema);
    if (!schemaValidation.valid) {
      return {
        ok: false,
        code: "validation_failed",
        message: `Internal Gemini schema validation failed: ${schemaValidation.errors.join("; ")}`,
        retryable: false,
      };
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelPool = getGeminiModelPool(preferredModel);

    let lastErrorMsg = "Gemini API call failed.";
    let lastCode: AiFailureCode = "provider_error";

    for (const currentModel of modelPool) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await ai.models.generateContent({
          model: currentModel,
          contents: [{ role: "user", parts: [{ text: options.user }] }],
          config: {
            systemInstruction: { parts: [{ text: options.system }] },
            responseMimeType: "application/json",
            responseSchema: sanitizedSchema as never,
            temperature: options.temperature ?? 0.1,
          },
        });
        clearTimeout(timer);

        const rawText = response.text;
        if (!rawText) {
          lastCode = "malformed_response";
          lastErrorMsg = `Gemini model ${currentModel} returned an empty candidate response.`;
          continue;
        }

        return {
          ok: true,
          rawText,
          promptTokens: response.usageMetadata?.promptTokenCount,
          completionTokens: response.usageMetadata?.candidatesTokenCount,
          totalTokens: response.usageMetadata?.totalTokenCount,
        };
      } catch (error) {
        clearTimeout(timer);
        const errObj = error as { status?: number; message?: string; name?: string };
        const rawMsg = errObj.message ?? String(error);
        const errorMsg = maskSecrets(rawMsg, [apiKey]);
        lastErrorMsg = errorMsg;

        if (
          errObj.name === "AbortError" ||
          errorMsg.includes("abort") ||
          errorMsg.includes("timed out")
        ) {
          lastCode = "timeout";
          lastErrorMsg = errorMsg.includes("timed out")
            ? errorMsg
            : `Gemini request timed out after ${timeoutMs}ms.`;
          console.warn(
            `[Gemini] Model ${currentModel} timed out after ${timeoutMs}ms. Trying next Gemini model in pool...`,
          );
          continue;
        }

        if (
          (errObj.status === 400 &&
            (errorMsg.includes("API key not valid") || errorMsg.includes("API_KEY_INVALID"))) ||
          errObj.status === 401 ||
          errObj.status === 403 ||
          errorMsg.includes("PERMISSION_DENIED")
        ) {
          return {
            ok: false,
            code: "authentication_failed",
            message: "Invalid Gemini API key or permission denied.",
            retryable: false,
          };
        }

        if (
          errObj.status === 429 ||
          errorMsg.includes("RESOURCE_EXHAUSTED") ||
          errorMsg.includes("quota") ||
          errorMsg.includes("rate limit") ||
          errorMsg.includes("429")
        ) {
          return {
            ok: false,
            code: "rate_limited",
            message: "Gemini rate limit or quota exceeded.",
            retryable: false,
          };
        }

        const isUnavailable =
          errObj.status === 503 ||
          errObj.status === 500 ||
          errObj.status === 404 ||
          errorMsg.includes("UNAVAILABLE") ||
          errorMsg.includes("high demand") ||
          errorMsg.includes("NOT_FOUND");

        if (isUnavailable) {
          lastCode = "provider_unavailable";
          console.warn(
            `[Gemini] Model ${currentModel} returned ${lastCode} (${errorMsg}). Trying next model in pool...`,
          );
          continue;
        }

        lastCode = "provider_error";
        break;
      }
    }

    return {
      ok: false,
      code: lastCode,
      message: lastErrorMsg,
      retryable: lastCode === "provider_unavailable" || lastCode === "provider_error",
    };
  }
}

// ──────────────────────────────────────────────────────────────
// 3. Groq (Fallback 2 — OpenAI-compatible tool_calls)
// ──────────────────────────────────────────────────────────────

class GroqProviderAdapter implements ProviderAdapter {
  readonly name = "groq" as const;

  async execute<T>(
    options: AiCallOptions<T>,
    apiKey: string,
    model: string,
    timeoutMs: number,
  ): Promise<ProviderAdapterResult> {
    assertValidModelId(model);
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
          ok: false,
          code: "rate_limited",
          message: "Groq rate limit reached.",
          retryable: false,
        };
      }
      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          code: "authentication_failed",
          message: "Groq API authentication failed.",
          retryable: false,
        };
      }
      if (response.status === 402) {
        return {
          ok: false,
          code: "payment_required",
          message: "Groq credits exhausted.",
          retryable: false,
        };
      }
      if (response.status === 503 || response.status === 502) {
        return {
          ok: false,
          code: "provider_unavailable",
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
          ok: false,
          code: response.status >= 500 ? "provider_unavailable" : "provider_error",
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
        ok: true,
        rawText,
        promptTokens: body.usage?.prompt_tokens,
        completionTokens: body.usage?.completion_tokens,
        totalTokens: body.usage?.total_tokens,
      };
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return {
          ok: false,
          code: "timeout",
          message: `Groq request timed out after ${timeoutMs}ms.`,
          retryable: false,
        };
      }
      return {
        ok: false,
        code: "provider_error",
        message: maskSecrets((error as Error).message, [apiKey]),
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

// ──────────────────────────────────────────────────────────────
// 4. OpenRouter (Fallback 3 — OpenAI-compatible JSON mode)
// ──────────────────────────────────────────────────────────────

class OpenRouterProviderAdapter implements ProviderAdapter {
  readonly name = "openrouter" as const;

  async execute<T>(
    options: AiCallOptions<T>,
    apiKey: string,
    model: string,
    timeoutMs: number,
  ): Promise<ProviderAdapterResult> {
    assertValidModelId(model);
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
          max_tokens: 4000,
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
          ok: false,
          code: "rate_limited",
          message: "OpenRouter rate limit reached.",
          retryable: false,
        };
      }
      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          code: "authentication_failed",
          message: "OpenRouter authentication failed.",
          retryable: false,
        };
      }
      if (response.status === 402) {
        return {
          ok: false,
          code: "payment_required",
          message: "OpenRouter credits exhausted.",
          retryable: false,
        };
      }
      if (response.status === 503 || response.status === 502) {
        return {
          ok: false,
          code: "provider_unavailable",
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
          ok: false,
          code: response.status >= 500 ? "provider_unavailable" : "provider_error",
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
        ok: true,
        rawText,
        promptTokens: body.usage?.prompt_tokens,
        completionTokens: body.usage?.completion_tokens,
        totalTokens: body.usage?.total_tokens,
      };
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return {
          ok: false,
          code: "timeout",
          message: `OpenRouter request timed out after ${timeoutMs}ms.`,
          retryable: false,
        };
      }
      return {
        ok: false,
        code: "provider_error",
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
 * Codes that signal transient provider exhaustion and allow cascading to the next provider.
 * Validation failure, malformed responses, bad requests, or client errors do NOT cascade.
 */
const CASCADE_CODES = new Set<AiFailureCode>([
  "rate_limited",
  "payment_required",
  "timeout",
  "provider_unavailable",
  "provider_error",
]);

/**
 * Build the ordered list of available providers from environment:
 * 1. Qwen / DashScope (Primary)
 * 2. Google Gemini (Fallback 1)
 * 3. Groq (Fallback 2)
 * 4. OpenRouter (Fallback 3)
 */
function buildProviderCascade(modelOverride?: string): ProviderConfig[] {
  ensureServerEnv();
  const providers: ProviderConfig[] = [];

  // 1. Qwen / DashScope (Primary)
  const qwenKey = process.env["DASHSCOPE_API_KEY"];
  if (qwenKey && qwenKey.trim()) {
    const pool = getProviderModelPool(
      "qwen",
      modelOverride?.startsWith("qwen") ? modelOverride : undefined,
    );
    providers.push({
      adapter: new QwenProviderAdapter(),
      apiKey: qwenKey,
      model: pool[0] ?? DEFAULT_QWEN_MODEL,
    });
  }

  // 2. Google Gemini (Fallback 1)
  const geminiKey = process.env["GEMINI_API_KEY"];
  if (geminiKey && geminiKey.trim()) {
    const pool = getProviderModelPool(
      "gemini",
      modelOverride?.startsWith("gemini") ? modelOverride : undefined,
    );
    providers.push({
      adapter: new GeminiProviderAdapter(),
      apiKey: geminiKey,
      model: pool[0] ?? DEFAULT_GEMINI_MODEL,
    });
  }

  // 3. Groq (Fallback 2)
  const groqKey = process.env["GROQ_API_KEY"];
  if (groqKey && groqKey.trim()) {
    const pool = getProviderModelPool(
      "groq",
      modelOverride?.includes("gpt-oss") ? modelOverride : undefined,
    );
    providers.push({
      adapter: new GroqProviderAdapter(),
      apiKey: groqKey,
      model: pool[0] ?? DEFAULT_GROQ_MODEL,
    });
  }

  // 4. OpenRouter (Fallback 3)
  const openrouterKey = process.env["OPENROUTER_API_KEY"];
  if (openrouterKey && openrouterKey.trim()) {
    const pool = getProviderModelPool(
      "openrouter",
      modelOverride?.includes("nemotron") ? modelOverride : undefined,
    );
    providers.push({
      adapter: new OpenRouterProviderAdapter(),
      apiKey: openrouterKey,
      model: pool[0] ?? DEFAULT_OPENROUTER_MODEL,
    });
  }

  return providers;
}

// ──────────────────────────────────────────────────────────────
// Main entry point
// ──────────────────────────────────────────────────────────────

/**
 * Execute a structured AI call through the centralized provider cascade:
 * Qwen (Primary) → Gemini (Fallback 1) → Groq (Fallback 2) → OpenRouter (Fallback 3).
 *
 * Cascades to the next provider ONLY on transient infrastructure issues:
 * rate_limited (429), payment_required (402), timeout, provider_unavailable (503/502), provider_error (500).
 * Never cascades on schema validation_failed or malformed_response — those are content issues.
 */
export async function callStructuredAi<T>(options: AiCallOptions<T>): Promise<AiResult<T>> {
  const started = Date.now();
  const cascade = buildProviderCascade(options.model);

  if (cascade.length === 0) {
    return {
      ok: false,
      code: "not_configured",
      message:
        "AI is not configured for this environment. Please set DASHSCOPE_API_KEY, GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY.",
      usage: emptyUsage(DEFAULT_QWEN_MODEL, "qwen", started, 0),
    };
  }

  const timeoutMs = options.timeoutMs ?? 90_000;
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);

  let lastCode: AiFailureCode = "provider_error";
  let lastMessage = "AI request failed.";
  let lastProvider: ProviderId = cascade[0]!.adapter.name;
  let lastModel = cascade[0]!.model;
  let totalAttempts = 0;

  for (let i = 0; i < cascade.length; i++) {
    const currentConfig = cascade[i]!;
    const { adapter, apiKey, model } = currentConfig;
    lastProvider = adapter.name;
    lastModel = model;

    let attempts = 0;
    let providerSucceeded = false;

    while (attempts < maxAttempts) {
      attempts += 1;
      totalAttempts += 1;

      const attemptStart = Date.now();
      const result = await adapter.execute(options, apiKey, model, timeoutMs);
      const attemptLatency = Date.now() - attemptStart;

      if (!result.ok) {
        lastCode = result.code;
        lastMessage = result.message;

        console.warn(
          `[AI] provider=${adapter.name} model=${model} operation=${options.toolName} attempt=${attempts} status=${result.code} latency=${attemptLatency}ms`,
        );

        // Cascade codes: skip remaining attempts for this provider, cascade to next provider
        if (CASCADE_CODES.has(result.code)) {
          break;
        }

        // Non-retryable provider errors (e.g. invalid API key): stop immediately, do not cascade
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
        console.warn(
          `[AI] provider=${adapter.name} model=${model} operation=${options.toolName} attempt=${attempts} status=malformed_response`,
        );
        // Retry within the same provider (content issue, not provider issue)
        if (attempts >= maxAttempts) break;
        continue;
      }

      const parsed = options.schema.safeParse(payload);
      if (!parsed.success) {
        lastCode = "validation_failed";
        lastMessage = `The AI response did not match the expected schema: ${parsed.error.issues
          .slice(0, 3)
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`;
        console.warn(
          `[AI] provider=${adapter.name} model=${model} operation=${options.toolName} attempt=${attempts} status=validation_failed reason=${lastMessage}`,
        );
        // Retry within the same provider (content issue, not provider issue)
        if (attempts >= maxAttempts) break;
        continue;
      }

      console.log(
        `[AI] provider=${adapter.name} model=${model} operation=${options.toolName} attempt=${attempts} latency=${attemptLatency}ms tokens=${result.totalTokens ?? "n/a"}`,
      );

      providerSucceeded = true;
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

    if (providerSucceeded) {
      break;
    }

    // If this provider failed with a cascade code, log fallback and proceed to next provider
    if (CASCADE_CODES.has(lastCode) && i + 1 < cascade.length) {
      const nextProvider = cascade[i + 1]!.adapter.name;
      console.warn(
        `[AI] fallback provider=${nextProvider} previous=${adapter.name} reason=${lastCode}`,
      );
    } else if (!CASCADE_CODES.has(lastCode)) {
      // Hard failure (e.g. validation_failed, authentication_failed) — do NOT cascade
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
