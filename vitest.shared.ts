/**
 * Configuración compartida por `vitest.config.ts` (suite normal) y
 * `vitest.perf.config.ts` (benchmarks).
 *
 * Motivo (P1 · auditoría stack Vite 6 / Vitest 4): en Vitest 4 los proyectos NO
 * heredan `include`/`exclude`/`resolve` de la raíz. `vitest.perf.config.ts`
 * intentaba sobrescribir `test.include` a nivel raíz, pero los proyectos
 * `node`/`jsdom` traían su propio `include`, así que `test:perf` acababa
 * corriendo la suite normal y NINGÚN archivo `*.perf.*`. Aquí viven las piezas
 * comunes para que cada config declare proyectos explícitos sin duplicar nada.
 *
 * Las funciones reciben `root` explícito (en vez de usar `import.meta.url`)
 * porque estos módulos se cargan tanto desde los configs de Vitest (que esbuild
 * puede empaquetar como CJS) como desde tests normales en ESM.
 */
import path from "node:path";
import os from "node:os";

/**
 * Forks paralelos en local: dejamos 2 núcleos libres para el dev-server/HMR
 * y topamos en 8 para acotar el uso de RAM (8 × 4 GB heap = 32 GB).
 * `VITEST_FORKS` permite afinar el valor sin editar la config (ver
 * `scripts/bench-vitest-shards.sh` para medir antes de cambiarlo).
 */
export const LOCAL_FORKS =
  Number(process.env.VITEST_FORKS) || Math.max(2, Math.min(8, os.cpus().length - 2));

/** Workers por proyecto/global. CI conservador: 2 forks @ 8 GB heap. */
export const MAX_WORKERS = process.env.CI ? 2 : LOCAL_FORKS;

export interface AliasEntry {
  find: string | RegExp;
  replacement: string;
}

/**
 * Router 8 es ESM-only: se usan sus exports públicos sin aliases a archivos
 * internos. Los contratos de navegación/nuqs/Sentry verifican que compartan
 * contexto; no alterar el modo declarativo para resolver problemas de tests.
 */
export function aliasVitest(root: string): AliasEntry[] {
  return [
    { find: "@", replacement: path.resolve(root, "./src") },
    // En tests, @react-pdf/renderer apunta a un stub ligero
    // (src/test/mocks/reactPdfStub.tsx). Evita cargar fontkit/pdfkit por archivo.
    {
      find: "@react-pdf/renderer",
      replacement: path.resolve(root, "./src/test/mocks/reactPdfStub.tsx"),
    },
  ];
}

/** Globs de los benchmarks. Únicos que debe ejecutar `bun run test:perf`. */
export const PERF_GLOBS_NODE = ["src/**/*.perf.ts"] as const;
export const PERF_GLOBS_JSDOM = [
  "src/**/*.perf.tsx",
  "src/**/*.perf.test.tsx",
] as const;

/** Excluye siempre los benchmarks de la suite normal. */
export const NORMAL_EXCLUDE = [
  "node_modules/**",
  "dist/**",
  "src/**/*.perf.test.tsx",
  "src/**/*.perf.tsx",
  "src/**/*.perf.ts",
];

/** En perf sólo se descarta lo obvio; el filtro real lo hace `include`. */
export const PERF_EXCLUDE = ["node_modules/**", "dist/**"];

/** ¿La ruta corresponde a un archivo de benchmark? */
export function esArchivoPerf(rutaRelativa: string): boolean {
  return /\.perf(\.test)?\.tsx?$/.test(rutaRelativa.split(path.sep).join("/"));
}

export interface CommonTestOptions {
  /** Patrones a excluir (normal vs perf). */
  exclude: string[];
}

/**
 * Opciones comunes a TODOS los proyectos. `environment`, `setupFiles` e
 * `include` los define cada proyecto.
 *
 * Vitest 4 ("Pool Rework"): `poolOptions` desapareció y sus claves son opciones
 * de primer nivel (`maxForks`→`maxWorkers`, `minForks` eliminado). Se declaran
 * aquí porque el pool se resuelve POR proyecto.
 */
export function commonTest({ exclude }: CommonTestOptions) {
  return {
    globals: true,
    // Vitest 5 activa clearMocks por defecto. Conservar la semántica de la
    // suite existente; migrar mocks compartidos requeriría una ronda aparte.
    clearMocks: false,
    // Fija TZ para todos los tests: CI y locales en otra zona dan el mismo
    // resultado en `addDays`, `todayLocalISO`, `parseLocalMx`.
    // Never inherit the real project's DSN from .env into a test fork.
    // SDK contract tests supply their own mock DSN and in-memory transport.
    env: { TZ: "America/Mexico_City", VITE_SENTRY_DSN: "" },
    exclude,
    testTimeout: 15_000,
    hookTimeout: 15_000,
    teardownTimeout: 15_000,
    // Pool por procesos: cada archivo en un fork nuevo para liberar memoria
    // al terminar (PDFs / leak regression).
    pool: "forks" as const,
    maxWorkers: MAX_WORKERS,
    execArgv: process.env.CI
      ? ["--max-old-space-size=8192", "--expose-gc"]
      : ["--max-old-space-size=4096", "--expose-gc"],
    isolate: true,
    fileParallelism: true,
    sequence: { shuffle: false },
  };
}
