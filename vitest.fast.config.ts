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
      fileParallelism: true,
      poolOptions: {
        forks: {
          singleFork: false,
          maxForks: 4,
          minForks: 2,
          isolate: true,
          execArgv: ["--max-old-space-size=8192", "--expose-gc"],
        },
      },
    },
  })
);
