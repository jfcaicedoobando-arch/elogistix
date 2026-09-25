/**
 * Configuración dedicada a los benchmarks (`bun run test:perf`).
 *
 * P1 · auditoría stack Vite 6 / Vitest 4 — ANTES esta config hacía
 * `mergeConfig(baseConfig, { test: { include: [...perf] } })`. No funcionaba:
 * en Vitest 4 los proyectos `node`/`jsdom` de la config base traen su propio
 * `include`, que gana sobre el `include` raíz. Resultado: `test:perf` corría la
 * suite normal completa y ningún `*.perf.*`.
 *
 * Ahora declara proyectos PROPIOS (`perf-node`, `perf-jsdom`) cuyos `include`
 * son exclusivamente los globs de benchmark. Además, `perfGuard.setup.ts` aborta si
 * un archivo que NO es benchmark entra al run (protección en tiempo de
 * ejecución, por si alguien agrega un glob por error).
 */
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import {
  aliasVitest,
  commonTest,
  MAX_WORKERS,
  PERF_EXCLUDE,
  PERF_GLOBS_JSDOM,
  PERF_GLOBS_NODE,
} from "./vitest.shared";

const ROOT = __dirname;
const ALIAS = aliasVitest(ROOT);
const COMMON_TEST = commonTest({ exclude: [...PERF_EXCLUDE] });

export default defineConfig({
  plugins: [react()],
  test: {
    maxWorkers: MAX_WORKERS,
    projects: [
      {
        extends: false,
        plugins: [react()],
        resolve: { alias: ALIAS },
        test: {
          ...COMMON_TEST,
          name: "perf-node",
          environment: "node",
          setupFiles: ["./src/test/setup.node.ts", "./src/test/perfGuard.setup.ts"],
          include: [...PERF_GLOBS_NODE],
        },
      },
      {
        extends: false,
        plugins: [react()],
        resolve: { alias: ALIAS },
        test: {
          ...COMMON_TEST,
          name: "perf-jsdom",
          environment: "jsdom",
          setupFiles: ["./src/test/setup.ts", "./src/test/perfGuard.setup.ts"],
          include: [...PERF_GLOBS_JSDOM],
        },
      },
    ],
    // Los benchmarks miden tiempo, no cobertura.
    coverage: { enabled: false },
    reporters: ["default"],
  },
  resolve: { alias: ALIAS },
});
