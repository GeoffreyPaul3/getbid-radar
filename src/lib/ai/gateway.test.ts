import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  AI_GATEWAY_URL,
  callStructuredAi,
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

describe("callStructuredAi", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns not_configured when LOVABLE_API_KEY is missing", async () => {
    delete process.env["LOVABLE_API_KEY"];
    const result = await callStructuredAi(baseOptions);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("not_configured");
      expect(result.message).toContain("not configured");
      expect(result.usage.attempts).toBe(0);
    }
  });

  it("successfully returns structured data and usage metadata", async () => {
    process.env["LOVABLE_API_KEY"] = "test-secret-key-12345";

    const mockResponse = {
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  arguments: JSON.stringify({ greeting: "hello", count: 100 }),
                },
              },
            ],
          },
        },
      ],
      usage: {
        prompt_tokens: 150,
        completion_tokens: 50,
        total_tokens: 200,
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
      expect(result.data).toEqual({ greeting: "hello", count: 100 });
      expect(result.usage.promptTokens).toBe(150);
      expect(result.usage.completionTokens).toBe(50);
      expect(result.usage.totalTokens).toBe(200);
      expect(result.usage.attempts).toBe(1);
      expect(result.usage.durationMs).toBeGreaterThanOrEqual(0);
    }

    expect(fetchSpy).toHaveBeenCalledWith(
      AI_GATEWAY_URL,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-secret-key-12345",
        }),
      }),
    );

    // Verify secret is not exposed in the returned result
    expect(JSON.stringify(result)).not.toContain("test-secret-key-12345");
  });

  it("recovers from content if tool_calls is not present", async () => {
    process.env["LOVABLE_API_KEY"] = "test-secret-key";

    const mockResponse = {
      choices: [
        {
          message: {
            content: '```json\n{"greeting":"recovered","count":3}\n```',
          },
        },
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      }),
    );

    const result = await callStructuredAi(baseOptions);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ greeting: "recovered", count: 3 });
    }
  });

  it("handles validation failure and retries up to maxAttempts", async () => {
    process.env["LOVABLE_API_KEY"] = "test-secret-key";

    // Invalid payload: count is a string, not number
    const mockResponse = {
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  arguments: JSON.stringify({ greeting: "bad", count: "not-a-number" }),
                },
              },
            ],
          },
        },
      ],
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });
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

  it("fails immediately with payment_required on 402 without retrying", async () => {
    process.env["LOVABLE_API_KEY"] = "test-secret-key";

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await callStructuredAi({ ...baseOptions, maxAttempts: 3 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("payment_required");
      expect(result.usage.attempts).toBe(1);
    }
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("handles provider HTTP 500 error with bounded retry", async () => {
    process.env["LOVABLE_API_KEY"] = "test-secret-key";

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await callStructuredAi({ ...baseOptions, maxAttempts: 2 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("provider_error");
      expect(result.message).toContain("500");
      expect(result.usage.attempts).toBe(2);
    }
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("handles timeout gracefully", async () => {
    process.env["LOVABLE_API_KEY"] = "test-secret-key";

    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";

    const fetchSpy = vi.fn().mockRejectedValue(abortError);
    vi.stubGlobal("fetch", fetchSpy);

    const result = await callStructuredAi({ ...baseOptions, maxAttempts: 1, timeoutMs: 50 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("timeout");
      expect(result.message).toContain("timed out");
    }
  });
});
