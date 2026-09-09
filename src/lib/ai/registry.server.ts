/**
 * Centralized AI Provider Registry & Capability Matrix.
 *
 * Single source of truth for:
 * - Provider endpoints and credential resolution
 * - Model IDs and fallback pools
 * - Operation capabilities (structured extraction, matching, assessment)
 * - Validation rules preventing obsolete/deprecated models from shipping
 */
import { ensureServerEnv } from "../server-env";

export type ProviderId = "qwen" | "gemini" | "groq" | "openrouter";

export type AiOperation = "requirement_extraction" | "requirement_matching" | "bid_assessment";

export interface ProviderCapability {
  readonly provider: ProviderId;
  readonly priority: number;
  readonly defaultModel: string;
  readonly fallbackModels: readonly string[];
  readonly supportedOperations: readonly AiOperation[];
  readonly supportsStructuredOutput: boolean;
  readonly baseUrl: string;
  readonly envKeyName: string;
}

/**
 * Prohibited models known to be deprecated, non-existent, or incompatible.
 * If any of these are configured or requested, the registry rejects them immediately.
 */
export const FORBIDDEN_MODEL_IDS = new Set<string>([
  "llama-3.3-70b-versatile", // Decommissioned on Groq
]);

export const DEFAULT_QWEN_MODEL = "qwen-plus";
export const DEFAULT_QWEN_MODELS = ["qwen-plus", "qwen-max", "qwen-flash"] as const;
export const QWEN_BASE_URL =
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
export const DEFAULT_GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
] as const;
export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export const DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b";
export const DEFAULT_GROQ_MODELS = ["qwen/qwen3.8-27b", "openai/gpt-oss-120b"] as const;
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions";

export const DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";
export const DEFAULT_OPENROUTER_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nex-agi/nex-n2.5-pro:free",
] as const;
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

export const PROVIDER_CAPABILITIES: Record<ProviderId, ProviderCapability> = {
  qwen: {
    provider: "qwen",
    priority: 1,
    defaultModel: DEFAULT_QWEN_MODEL,
    fallbackModels: DEFAULT_QWEN_MODELS,
    supportedOperations: ["requirement_extraction", "requirement_matching", "bid_assessment"],
    supportsStructuredOutput: true,
    baseUrl: QWEN_BASE_URL,
    envKeyName: "DASHSCOPE_API_KEY",
  },
  gemini: {
    provider: "gemini",
    priority: 2,
    defaultModel: DEFAULT_GEMINI_MODEL,
    fallbackModels: DEFAULT_GEMINI_MODELS,
    supportedOperations: ["requirement_extraction", "requirement_matching", "bid_assessment"],
    supportsStructuredOutput: true,
    baseUrl: GEMINI_BASE_URL,
    envKeyName: "GEMINI_API_KEY",
  },
  groq: {
    provider: "groq",
    priority: 3,
    defaultModel: DEFAULT_GROQ_MODEL,
    fallbackModels: DEFAULT_GROQ_MODELS,
    supportedOperations: ["requirement_extraction", "requirement_matching", "bid_assessment"],
    supportsStructuredOutput: true,
    baseUrl: GROQ_BASE_URL,
    envKeyName: "GROQ_API_KEY",
  },
  openrouter: {
    provider: "openrouter",
    priority: 4,
    defaultModel: DEFAULT_OPENROUTER_MODEL,
    fallbackModels: DEFAULT_OPENROUTER_MODELS,
    supportedOperations: ["requirement_extraction", "requirement_matching", "bid_assessment"],
    supportsStructuredOutput: true,
    baseUrl: OPENROUTER_BASE_URL,
    envKeyName: "OPENROUTER_API_KEY",
  },
};

/**
 * Validate whether a model name is permitted and safe to execute.
 * Throws an explicit error if a known deprecated/invalid model ID is detected.
 */
export function assertValidModelId(model: string): void {
  const trimmed = model.trim().toLowerCase();
  for (const forbidden of FORBIDDEN_MODEL_IDS) {
    if (trimmed === forbidden.toLowerCase() || trimmed.includes(forbidden.toLowerCase())) {
      throw new Error(
        `[Provider Registry] Prohibited model ID "${model}" detected. This model is deprecated or unsupported.`,
      );
    }
  }
}

/**
 * Returns the configured model pool for a given provider.
 * Respects environment variable overrides while excluding forbidden models.
 */
export function getProviderModelPool(provider: ProviderId, preferredModel?: string): string[] {
  ensureServerEnv();
  const cap = PROVIDER_CAPABILITIES[provider];
  let pool: string[] = [];

  switch (provider) {
    case "qwen": {
      const envModel = process.env["DASHSCOPE_MODEL"] || process.env["QWEN_MODEL"];
      pool = envModel
        ? [envModel, ...DEFAULT_QWEN_MODELS.filter((m) => m !== envModel)]
        : [...DEFAULT_QWEN_MODELS];
      break;
    }
    case "gemini": {
      const envModels = process.env["GEMINI_MODELS"]
        ? process.env["GEMINI_MODELS"]
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      const envModel = process.env["GEMINI_MODEL"];
      const basePool = envModels.length > 0 ? envModels : [...DEFAULT_GEMINI_MODELS];
      pool = envModel ? [envModel, ...basePool.filter((m) => m !== envModel)] : basePool;
      break;
    }
    case "groq": {
      const envModel = process.env["GROQ_MODEL"];
      pool = envModel
        ? [envModel, ...DEFAULT_GROQ_MODELS.filter((m) => m !== envModel)]
        : [...DEFAULT_GROQ_MODELS];
      break;
    }
    case "openrouter": {
      const envModel = process.env["OPENROUTER_MODEL"];
      pool = envModel
        ? [envModel, ...DEFAULT_OPENROUTER_MODELS.filter((m) => m !== envModel)]
        : [...DEFAULT_OPENROUTER_MODELS];
      break;
    }
  }

  // Filter forbidden models
  pool = pool.filter((m) => !FORBIDDEN_MODEL_IDS.has(m));

  if (preferredModel && !FORBIDDEN_MODEL_IDS.has(preferredModel)) {
    pool = [preferredModel, ...pool.filter((m) => m !== preferredModel)];
  }

  return pool.length > 0 ? pool : [cap.defaultModel];
}

/**
 * Checks if a provider supports a specific operation.
 */
export function isOperationSupported(provider: ProviderId, operation: AiOperation): boolean {
  const cap = PROVIDER_CAPABILITIES[provider];
  return cap.supportedOperations.includes(operation);
}

/**
 * Performs startup/runtime health checks on AI configuration.
 * Returns report with status of each provider and primary availability.
 */
export function validateAiConfiguration(): {
  primaryConfigured: boolean;
  configuredProviders: ProviderId[];
  missingProviders: ProviderId[];
  warnings: string[];
} {
  ensureServerEnv();
  const configuredProviders: ProviderId[] = [];
  const missingProviders: ProviderId[] = [];
  const warnings: string[] = [];

  const providers: ProviderId[] = ["qwen", "gemini", "groq", "openrouter"];

  for (const p of providers) {
    const cap = PROVIDER_CAPABILITIES[p];
    const key = process.env[cap.envKeyName];
    if (key && key.trim().length > 0) {
      try {
        const pool = getProviderModelPool(p);
        for (const m of pool) {
          assertValidModelId(m);
        }
        configuredProviders.push(p);
      } catch (err) {
        warnings.push(`Provider ${p} has invalid model configuration: ${(err as Error).message}`);
      }
    } else {
      missingProviders.push(p);
    }
  }

  const primaryConfigured = configuredProviders.includes("qwen");
  if (!primaryConfigured) {
    warnings.push("Primary provider Qwen (DASHSCOPE_API_KEY) is not configured.");
  }

  return {
    primaryConfigured,
    configuredProviders,
    missingProviders,
    warnings,
  };
}
