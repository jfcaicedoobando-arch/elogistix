import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config";

// Configuración dedicada para tests de performance/benchmark.
// Reutiliza la base (plugins, alias, pool forks, isolate) pero anula
// `include`/`exclude` para correr ÚNICAMENTE los archivos `*.perf.*`
// que el run regular excluye intencionalmente.
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ["src/**/*.perf.test.tsx", "src/**/*.perf.ts"],
      exclude: ["node_modules/**", "dist/**"],
    },
  })
);
