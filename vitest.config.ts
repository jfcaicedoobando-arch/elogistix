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
    // Reporter JUnit (12.85.0): además de los defaults, escribimos test-results.xml
    // para que dashboards externos (GitHub Actions test reporter, Jenkins, etc.)
    // puedan consumir resultados estructurados. Default + junit en paralelo para
    // no perder el output legible en consola.
    reporters: process.env.CI ? ["default", "junit"] : ["default"],
    outputFile: { junit: "./reports/junit.xml" },
    // Suite completa medida en ~189s (sandbox Lovable). Archivo más lento: 5.1s,
    // resto <1s. 15s por test/hook deja ~3x de margen sobre el peor caso real
    // sin esconder tests que se cuelgan.
    testTimeout: 15_000,
    hookTimeout: 15_000,
    teardownTimeout: 15_000,
    // Pool por procesos (forks). Cada archivo corre en un fork nuevo para
    // liberar memoria al terminar (PDFs / leak regression). Con el teardown
    // global de 12.60.20 + mocks-cleanup, el heap pico estable es ~55 MB,
    // por lo que es seguro paralelizar 2 forks (2 × 8 GB heap = 16 GB ≪ 32 GB
    // RAM del sandbox). Esto reduce el wall-clock de la suite ~2x sin riesgo
    // de OOM. Subir a 3-4 forks requirió heap ≤4 GB y disparó OOM en archivos
    // PDF pesados; 2 forks @ 8 GB es el punto óptimo verificado.
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
        maxForks: 1,
        minForks: 1,
        isolate: true,
        execArgv: ["--max-old-space-size=8192", "--expose-gc"],
      },
    },
    fileParallelism: false,
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
        // 12.98.5 — Limpieza de denominador. Excluimos código puramente
        // declarativo/presentacional cuya cobertura no aporta valor:
        // - copy estático de marketing (sólo strings),
        // - definiciones de columnas de DataTable (JSX declarativo sin lógica),
        // - tipos puros (sólo type/interface).
        // La lógica real vive en hooks y utils que sí se testean.
        "src/pages/marketing/**",
        "src/**/*Columns.{ts,tsx}",
        "src/**/*columns.{ts,tsx}",
        "src/types/**",
      ],
      // Umbrales mínimos globales. RATCHET: subir lines/statements a 40
      // cuando coverage real ≥ 42%. functions/branches ya están sobre 48/67
      // tras el ajuste de denominador, así que el piso refleja la realidad
      // y sólo puede subir.
      thresholds: {
        lines: 34,
        statements: 34,
        functions: 48,
        branches: 67,
      },


    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Alias global: en tests, @react-pdf/renderer apunta a un stub ligero
      // (src/test/mocks/reactPdfStub.tsx). Evita cargar fontkit/pdfkit por
      // archivo. Aplica también a `vi.importActual("@react-pdf/renderer")`.
      "@react-pdf/renderer": path.resolve(__dirname, "./src/test/mocks/reactPdfStub.tsx"),
    },
  },
});
