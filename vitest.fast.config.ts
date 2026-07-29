import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config";

// Configuración para `bun run test:fast`.
// Reutiliza la base pero habilita paralelismo entre archivos y múltiples forks
// para reducir el tiempo de wall-clock en desarrollo local. El pool de forks
// mantiene el aislamiento entre archivos pesados (PDFs / leaks) y el execArgv
// de heap ampliado.
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // v13.342.0 — El paralelismo (forks/heap/fileParallelism) ya vive en la
      // config base, derivado de los núcleos reales. Aquí sólo heredamos.
      pool: "forks",
      isolate: true,
    },
  })
);
