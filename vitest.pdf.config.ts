import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "node:url";

// Deliberately does NOT import aliasVitest: this lane must use the real renderer.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/pdf/**/*.test.tsx"],
    environment: "node", pool: "forks", maxWorkers: 1,
    testTimeout: 30_000, hookTimeout: 30_000,
    env: { TZ: "America/Mexico_City", VITE_SENTRY_DSN: "" },
  },
});
