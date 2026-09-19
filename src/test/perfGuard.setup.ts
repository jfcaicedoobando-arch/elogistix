/**
 * Protección de selección para `bun run test:perf`.
 *
 * Analogía: es el portero de la pista de carreras. Si entra un coche que no es
 * de carreras (una prueba normal), lo detiene en la puerta en vez de dejarlo
 * correr y contaminar la medición.
 *
 * Sólo se carga desde `vitest.perf.config.ts`. Si el archivo bajo ejecución no
 * es un benchmark (`*.perf.ts`, `*.perf.tsx`, `*.perf.test.tsx`), falla ruidoso.
 */
import { beforeAll, expect } from "vitest";
import { esArchivoPerf } from "../../vitest.shared";

beforeAll(() => {
  const ruta = expect.getState().testPath ?? "";
  if (!esArchivoPerf(ruta)) {
    throw new Error(
      `[test:perf] "${ruta}" no es un benchmark (*.perf.ts / *.perf.tsx / *.perf.test.tsx). ` +
        "Revisa el `include` de vitest.perf.config.ts: test:perf sólo debe ejecutar benchmarks.",
    );
  }
});
