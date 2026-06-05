import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Excluimos defaults de Vitest + tests de performance que sólo deben
    // correr bajo demanda (consumen mucha memoria y enmascaran timeouts).
    exclude: [
      "node_modules/**",
      "dist/**",
      "src/**/*.perf.test.tsx",
      "src/**/*.perf.ts",
    ],
    // Suite completa medida en ~189s (sandbox Lovable). Archivo más lento: 5.1s,
    // resto <1s. 15s por test/hook deja ~3x de margen sobre el peor caso real
    // sin esconder tests que se cuelgan.
    testTimeout: 15_000,
    hookTimeout: 15_000,
    // Pool por procesos (forks) con heap ampliado en cada worker para evitar el
    // OOM observado (~6GB) al correr los ~289 archivos en una sola invocación.
    // `isolate: true` a nivel pool garantiza que cada archivo corra en un fork
    // limpio (JSDOM, módulos, caches), reforzando el aislamiento global.
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: false,
        maxForks: 2,
        minForks: 1,
        isolate: true,
        execArgv: ["--max-old-space-size=8192"],
      },
    },
    isolate: true,
    sequence: { shuffle: false },
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json", "json-summary", "lcov", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "node_modules/",
        "src/test/",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/**/*.d.ts",
        "src/**/__tests__/**",
        "src/components/ui/**",
        "src/hooks/use-toast.ts",
        "src/lib/utils.ts",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "src/integrations/supabase/**",
      ],
      // Umbrales mínimos globales. Subir gradualmente conforme avance la cobertura.
      // Actualmente la app tiene ~14-27% de file-coverage; arrancamos en 10% para
      // que CI no falle y vamos elevando en cada milestone.
      thresholds: {
        lines: 10,
        statements: 10,
        functions: 10,
        branches: 50,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
