import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config";

// Configuración dedicada para tests de performance/benchmark.
//
// v13.513.0 — Se conserva (a diferencia de `vitest.fast.config.ts`, eliminado)
// porque los `*.perf.*` están excluidos a nivel de proyecto en la config base:
// un `vitest run <ruta>` con `--exclude` por CLI no los rescata. Esta config
// anula `include`/`exclude` para correr ÚNICAMENTE esos archivos.
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ["src/**/*.perf.test.tsx", "src/**/*.perf.ts"],
      exclude: ["node_modules/**", "dist/**"],
    },
  })
);
