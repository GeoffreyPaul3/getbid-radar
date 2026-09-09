import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  // Populate process.env for Node/SSR server execution (does not expose non-VITE_ keys to client bundle)
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, val] of Object.entries(env)) {
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }

  return {
    plugins: [tanstackStart(), react(), tailwindcss()],
    resolve: {
      tsconfigPaths: true,
    },
  };
});
