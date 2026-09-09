import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  callStructuredAi,
  cleanSchemaForGemini,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GROQ_MODEL,
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_QWEN_MODEL,
  GEMINI_BASE_URL,
  GROQ_BASE_URL,
  OPENROUTER_BASE_URL,
  QWEN_BASE_URL,
  maskSecrets,
  recoverJson,
  type AiCallOptions,
} from "./gateway.server";

const testSchema = z.object({
  greeting: z.string(),
  count: z.number(),
});
type TestType = z.infer<typeof testSchema>;

const baseOptions: AiCallOptions<TestType> = {
  system: "You are a test assistant.",
  user: "Generate test data.",
  toolName: "emit_test",
  toolDescription: "Emits test data",
  jsonSchema: {
    type: "object",
    properties: {
      greeting: { type: "string" },
      count: { type: "number" },
    },
    required: ["greeting", "count"],
  },
  schema: testSchema,
  maxAttempts: 2,
  timeoutMs: 5000,
};

function mockResponse(data: unknown, status = 200) {
  const body = typeof data === "string" ? data : JSON.stringify(data);
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("recoverJson", () => {
  it("parses clean JSON", () => {
    expect(recoverJson('{"greeting":"hello","count":42}')).toEqual({
      greeting: "hello",
      count: 42,
    });
  });

  it("recovers JSON wrapped in markdown code fences", () => {
    const raw = '```json\n{\n  "greeting": "world",\n  "count": 7\n}\n```';
    expect(recoverJson(raw)).toEqual({ greeting: "world", count: 7 });
  });

  it("recovers JSON embedded within surrounding text", () => {
    const raw = 'Here is the response: {"greeting": "nested", "count": 10} hope this helps!';
    expect(recoverJson(raw)).toEqual({ greeting: "nested", count: 10 });
  });

  it("returns undefined for non-JSON string", () => {
    expect(recoverJson("I cannot fulfill this request.")).toBeUndefined();
  });
});

describe("cleanSchemaForGemini", () => {
  it("removes $schema and additionalProperties recursively", () => {
    const rawSchema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
            },
          },
        },
      },
    };

    const cleaned = cleanSchemaForGemini(rawSchema) as Record<string, unknown>;
    expect(cleaned["$schema"]).toBeUndefined();
    const cleanedProperties = cleaned["properties"] as Record<string, Record<string, any>>;
    const itemsProp = cleanedProperties["items"]!;
    const itemsItems = itemsProp["items"] as Record<string, any>;
    expect(itemsItems["additionalProperties"]).toBeUndefined();
    expect((itemsItems["properties"] as Record<string, any>)["name"]?.["type"]).toBe("STRING");
  });
});

describe("maskSecrets", () => {
  it("redacts matching secrets from error strings", () => {
    const result = maskSecrets("Failed to call API with key sk-1234567890", ["sk-1234567890"]);
    expect(result).toBe("Failed to call API with key [REDACTED]");
  });

  it("handles null and short secrets safely", () => {
    expect(maskSecrets("clean message", [null, undefined, "abc"])).toBe("clean message");
  });
});

describe("callStructuredAi", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env["DASHSCOPE_API_KEY"];
    delete process.env["GEMINI_API_KEY"];
    delete process.env["GROQ_API_KEY"];
    delete process.env["OPENROUTER_API_KEY"];
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns not_configured when all provider API keys are missing", async () => {
    const result = await callStructuredAi(baseOptions);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("not_configured");
      expect(result.message).toContain("not configured");
      expect(result.usage.attempts).toBe(0);
    }
  });

  /* ------------------------------------------------------------------ */
  /* 1. Qwen / DashScope Provider Tests (Primary)                       */
  /* ------------------------------------------------------------------ */

  describe("Qwen / DashScope Provider Adapter", () => {
    it("successfully sends Qwen payload with tools and parses response", async () => {
      process.env["DASHSCOPE_API_KEY"] = "sk-dashscope-test-key-12345";

      const mockQwenResponse = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  function: {
                    arguments: JSON.stringify({ greeting: "Hello from Qwen Plus", count: 108 }),
                  },
                },
              ],
            },
          },
        ],
        usage: {
          prompt_tokens: 45,
          completion_tokens: 15,
          total_tokens: 60,
        },
      };

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockQwenResponse,
      });
      vi.stubGlobal("fetch", fetchSpy);

      const result = await callStructuredAi(baseOptions);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ greeting: "Hello from Qwen Plus", count: 108 });
        expect(result.usage.activeProvider).toBe("qwen");
        expect(result.usage.model).toBe(DEFAULT_QWEN_MODEL);
        expect(result.usage.promptTokens).toBe(45);
        expect(result.usage.completionTokens).toBe(15);
        expect(result.usage.totalTokens).toBe(60);
      }

      expect(fetchSpy).toHaveBeenCalledWith(
        QWEN_BASE_URL,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer sk-dashscope-test-key-12345",
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("handles Qwen 429 rate limit correctly", async () => {
      process.env["DASHSCOPE_API_KEY"] = "sk-dashscope-key";

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: "Rate limit reached" } }),
      });
      vi.stubGlobal("fetch", fetchSpy);

      const result = await callStructuredAi({ ...baseOptions, maxAttempts: 1 });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("rate_limited");
        expect(result.message).toContain("rate limit");
      }
    });

    it("handles Qwen 503 service unavailable as provider_unavailable", async () => {
      process.env["DASHSCOPE_API_KEY"] = "sk-dashscope-key";

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: { message: "Server overloaded" } }),
      });
      vi.stubGlobal("fetch", fetchSpy);

      const result = await callStructuredAi({ ...baseOptions, maxAttempts: 1 });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("provider_unavailable");
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /* 2. Google Gemini Provider Tests                                    */
  /* ------------------------------------------------------------------ */

  describe("Google Gemini Provider Adapter", () => {
    it("successfully sends Gemini payload with x-goog-api-key header and parses structured output", async () => {
      process.env["GEMINI_API_KEY"] = "ai-secret-gemini-key-999";
      process.env["GEMINI_MODEL"] = "gemini-3.5-flash";

      const mockGeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({ greeting: "Hello from Gemini", count: 42 }),
                },
              ],
            },
            finishReason: "STOP",
          },
        ],
        usageMetadata: {
          promptTokenCount: 120,
          candidatesTokenCount: 35,
          totalTokenCount: 155,
        },
      };

      const fetchSpy = vi.fn().mockResolvedValue(mockResponse(mockGeminiResponse));
      vi.stubGlobal("fetch", fetchSpy);

      const result = await callStructuredAi(baseOptions);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ greeting: "Hello from Gemini", count: 42 });
        expect(result.usage.activeProvider).toBe("gemini");
        expect(result.usage.model).toBe("gemini-3.5-flash");
        expect(result.usage.promptTokens).toBe(120);
        expect(result.usage.completionTokens).toBe(35);
        expect(result.usage.totalTokens).toBe(155);
        expect(result.usage.attempts).toBe(1);
      }

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/gemini-3.5-flash:generateContent"),
        expect.anything(),
      );

      const callArgs = fetchSpy.mock.calls[0]!;
      const headers = callArgs[1].headers;
      const keyHeader =
        typeof headers?.get === "function"
          ? headers.get("x-goog-api-key")
          : headers?.["x-goog-api-key"];
      expect(keyHeader).toBe("ai-secret-gemini-key-999");
    });

    it("handles Gemini invalid API key error without retrying", async () => {
      process.env["GEMINI_API_KEY"] = "invalid-key-xyz";

      const fetchSpy = vi.fn().mockResolvedValue(
        mockResponse(
          {
            error: {
              code: 400,
              message: "API key not valid. Please pass a valid API key.",
              status: "INVALID_ARGUMENT",
            },
          },
          400,
        ),
      );
      vi.stubGlobal("fetch", fetchSpy);

      const result = await callStructuredAi({ ...baseOptions, maxAttempts: 3 });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("authentication_failed");
        expect(result.message).toContain("Invalid Gemini API key");
        expect(result.usage.attempts).toBe(1);
      }
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("handles Gemini HTTP 503 error as provider_unavailable", async () => {
      process.env["GEMINI_API_KEY"] = "gemini-key";
      process.env["GEMINI_MODELS"] = "gemini-3.5-flash";

      const fetchSpy = vi
        .fn()
        .mockResolvedValue(
          mockResponse({ error: { message: "Service Unavailable", status: "UNAVAILABLE" } }, 503),
        );
      vi.stubGlobal("fetch", fetchSpy);

      const result = await callStructuredAi({ ...baseOptions, maxAttempts: 1 });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("provider_unavailable");
      }
    });

    it("handles validation failure and retries up to maxAttempts within Gemini", async () => {
      process.env["GEMINI_API_KEY"] = "gemini-key";

      const mockResponseData = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({ greeting: "bad", count: "not-a-number" }),
                },
              ],
            },
          },
        ],
      };

      const fetchSpy = vi.fn().mockImplementation(() => mockResponse(mockResponseData));
      vi.stubGlobal("fetch", fetchSpy);

      const result = await callStructuredAi({ ...baseOptions, maxAttempts: 2 });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("validation_failed");
        expect(result.message).toContain("did not match the expected schema");
        expect(result.usage.attempts).toBe(2);
      }
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  /* ------------------------------------------------------------------ */
  /* 3. Groq Provider Tests                                             */
  /* ------------------------------------------------------------------ */

  describe("Groq Provider Adapter", () => {
    it("successfully sends Groq payload with tool_calls and parses response", async () => {
      process.env["GROQ_API_KEY"] = "gsk_test_groq_key_12345";

      const mockGroqResponse = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  function: {
                    arguments: JSON.stringify({ greeting: "Hello from Groq", count: 99 }),
                  },
                },
              ],
            },
          },
        ],
        usage: {
          prompt_tokens: 80,
          completion_tokens: 25,
          total_tokens: 105,
        },
      };

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockGroqResponse,
      });
      vi.stubGlobal("fetch", fetchSpy);

      const result = await callStructuredAi(baseOptions);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ greeting: "Hello from Groq", count: 99 });
        expect(result.usage.activeProvider).toBe("groq");
        expect(result.usage.model).toBe(DEFAULT_GROQ_MODEL);
        expect(result.usage.promptTokens).toBe(80);
        expect(result.usage.completionTokens).toBe(25);
        expect(result.usage.totalTokens).toBe(105);
      }

      expect(fetchSpy).toHaveBeenCalledWith(
        GROQ_BASE_URL,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer gsk_test_groq_key_12345",
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("handles Groq 429 rate limit correctly", async () => {
      process.env["GROQ_API_KEY"] = "gsk_test_key";

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
      });
      vi.stubGlobal("fetch", fetchSpy);

      const result = await callStructuredAi({ ...baseOptions, maxAttempts: 1 });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("rate_limited");
        expect(result.message).toContain("Groq rate limit");
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /* 4. OpenRouter Provider Tests                                       */
  /* ------------------------------------------------------------------ */

  describe("OpenRouter Provider Adapter", () => {
    it("successfully sends OpenRouter payload with headers and parses content", async () => {
      process.env["OPENROUTER_API_KEY"] = "sk-or-v1-test-key";

      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({ greeting: "Hello from OpenRouter", count: 77 }),
            },
          },
        ],
        usage: {
          prompt_tokens: 60,
          completion_tokens: 20,
          total_tokens: 80,
        },
      };

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });
      vi.stubGlobal("fetch", fetchSpy);

      const result = await callStructuredAi(baseOptions);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ greeting: "Hello from OpenRouter", count: 77 });
        expect(result.usage.activeProvider).toBe("openrouter");
        expect(result.usage.model).toBe(DEFAULT_OPENROUTER_MODEL);
        expect(result.usage.promptTokens).toBe(60);
      }

      expect(fetchSpy).toHaveBeenCalledWith(
        OPENROUTER_BASE_URL,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer sk-or-v1-test-key",
            "HTTP-Referer": "https://getbidradar.com",
            "X-Title": "GetBidRadar",
          }),
        }),
      );
    });
  });

  /* ------------------------------------------------------------------ */
  /* 5. Provider Cascade & Failure Injection Tests                      */
  /* ------------------------------------------------------------------ */

  describe("Provider Cascade Behavior & Failure Injection", () => {
    it("prioritizes Qwen as primary when all providers are configured", async () => {
      process.env["DASHSCOPE_API_KEY"] = "dashscope-key";
      process.env["GEMINI_API_KEY"] = "gemini-key";
      process.env["GROQ_API_KEY"] = "groq-key";
      process.env["OPENROUTER_API_KEY"] = "openrouter-key";

      const fetchSpy = vi.fn().mockImplementation((url: string) => {
        if (url.includes("dashscope")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: {
                    tool_calls: [
                      {
                        function: {
                          arguments: JSON.stringify({ greeting: "Primary Qwen", count: 1 }),
                        },
                      },
                    ],
                  },
                },
              ],
            }),
          });
        }
        return Promise.reject(new Error("Should not call secondary providers"));
      });
      vi.stubGlobal("fetch", fetchSpy);

      const result = await callStructuredAi(baseOptions);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.usage.activeProvider).toBe("qwen");
        expect(result.data.greeting).toBe("Primary Qwen");
      }
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("cascades from Qwen to Gemini on Qwen 503", async () => {
      process.env["DASHSCOPE_API_KEY"] = "dashscope-key";
      process.env["GEMINI_API_KEY"] = "gemini-key";

      const fetchSpy = vi.fn().mockImplementation((url: string) => {
        if (url.includes("dashscope")) {
          return Promise.resolve({
            ok: false,
            status: 503,
            json: async () => ({ error: { message: "Qwen overloaded" } }),
          });
        }
        if (url.includes("generativelanguage.googleapis.com")) {
          return Promise.resolve(
            mockResponse({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({ greeting: "Fallback Gemini", count: 2 }),
                      },
                    ],
                  },
                },
              ],
            }),
          );
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });
      vi.stubGlobal("fetch", fetchSpy);

      const result = await callStructuredAi(baseOptions);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.usage.activeProvider).toBe("gemini");
        expect(result.data.greeting).toBe("Fallback Gemini");
      }
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("cascades through Qwen (503) → Gemini (503) → Groq (success)", async () => {
      process.env["DASHSCOPE_API_KEY"] = "dashscope-key";
      process.env["GEMINI_API_KEY"] = "gemini-key";
      process.env["GROQ_API_KEY"] = "groq-key";

      const fetchSpy = vi.fn().mockImplementation((url: string) => {
        if (url.includes("dashscope")) {
          return Promise.resolve({ ok: false, status: 503 });
        }
        if (url.includes("generativelanguage.googleapis.com")) {
          return Promise.resolve(mockResponse({ error: { message: "Gemini 503" } }, 503));
        }
        if (url.includes("api.groq.com")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: {
                    tool_calls: [
                      {
                        function: {
                          arguments: JSON.stringify({ greeting: "Fallback Groq", count: 3 }),
                        },
                      },
                    ],
                  },
                },
              ],
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });
      vi.stubGlobal("fetch", fetchSpy);

      const result = await callStructuredAi(baseOptions);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.usage.activeProvider).toBe("groq");
        expect(result.data.greeting).toBe("Fallback Groq");
      }
    });

    it("cascades through Qwen → Gemini → Groq → OpenRouter (success)", async () => {
      process.env["DASHSCOPE_API_KEY"] = "dashscope-key";
      process.env["GEMINI_API_KEY"] = "gemini-key";
      process.env["GROQ_API_KEY"] = "groq-key";
      process.env["OPENROUTER_API_KEY"] = "openrouter-key";

      const fetchSpy = vi.fn().mockImplementation((url: string) => {
        if (url.includes("dashscope")) return Promise.resolve({ ok: false, status: 503 });
        if (url.includes("generativelanguage.googleapis.com"))
          return Promise.resolve(mockResponse({ error: { message: "Gemini 503" } }, 503));
        if (url.includes("api.groq.com")) return Promise.resolve({ ok: false, status: 503 });
        if (url.includes("openrouter.ai")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({ greeting: "Fallback OpenRouter", count: 4 }),
                  },
                },
              ],
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });
      vi.stubGlobal("fetch", fetchSpy);

      const result = await callStructuredAi(baseOptions);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.usage.activeProvider).toBe("openrouter");
        expect(result.data.greeting).toBe("Fallback OpenRouter");
      }
    });

    it("fails cleanly when all providers return transient errors without producing false decisions", async () => {
      process.env["DASHSCOPE_API_KEY"] = "dashscope-key";
      process.env["GEMINI_API_KEY"] = "gemini-key";
      process.env["GROQ_API_KEY"] = "groq-key";
      process.env["OPENROUTER_API_KEY"] = "openrouter-key";

      const fetchSpy = vi.fn().mockImplementation(() => {
        return Promise.resolve({ ok: false, status: 503 });
      });
      vi.stubGlobal("fetch", fetchSpy);

      const result = await callStructuredAi({ ...baseOptions, maxAttempts: 1 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("provider_unavailable");
      }
    });

    it("does NOT cascade to next provider on schema validation failure", async () => {
      process.env["DASHSCOPE_API_KEY"] = "dashscope-key";
      process.env["GEMINI_API_KEY"] = "gemini-key";

      const fetchSpy = vi.fn().mockImplementation((url: string) => {
        if (url.includes("dashscope")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: {
                    tool_calls: [
                      {
                        function: {
                          arguments: JSON.stringify({ invalidField: "bad" }),
                        },
                      },
                    ],
                  },
                },
              ],
            }),
          });
        }
        return Promise.reject(new Error(`Gemini should not have been called!`));
      });
      vi.stubGlobal("fetch", fetchSpy);

      const result = await callStructuredAi({ ...baseOptions, maxAttempts: 2 });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("validation_failed");
        expect(result.usage.activeProvider).toBe("qwen");
      }
      // Both attempts should be against Qwen, never Gemini
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      for (const call of fetchSpy.mock.calls) {
        expect(call[0]).toContain("dashscope");
      }
    });
  });
});
