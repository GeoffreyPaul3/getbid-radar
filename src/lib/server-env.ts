/**
 * Server-only environment initializer.
 * Loads .env into process.env if in Node.js runtime and variables are not already set.
 * NEVER exposed or imported in client components.
 */
import fs from "node:fs";
import path from "node:path";

let initialized = false;

export function ensureServerEnv(): void {
  if (initialized) return;
  initialized = true;

  if (typeof process === "undefined" || !process.env) return;

  // If GEMINI_API_KEY is already present in process.env, nothing to load
  if (process.env["GEMINI_API_KEY"]) return;

  // In Node 20.12+, process.loadEnvFile is native
  if (typeof process.loadEnvFile === "function") {
    try {
      const envPath = path.resolve(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        process.loadEnvFile(envPath);
        return;
      }
    } catch {
      // Ignore if .env is missing or cannot be read
    }
  }

  // Fallback safe line parser if process.loadEnvFile is unavailable
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed
            .slice(eqIdx + 1)
            .trim()
            .replace(/^["']|["']$/g, "");
          if (key && !(key in process.env)) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch {
    // Ignore in read-only environments
  }
}

// Auto-run when imported in a server module
ensureServerEnv();
