/**
 * Protección de la selección de `bun run test:perf`.
 *
 * Antes, `vitest.perf.config.ts` intentaba sobrescribir `test.include` desde la
 * raíz, pero los proyectos node/jsdom traían su propio `include` y ganaban: el
 * comando corría la suite normal y ningún benchmark. Estas pruebas fallan si
 * alguien vuelve a mezclar ambos conjuntos.
 */
import { describe, it, expect } from "vitest";
import {
  esArchivoPerf,
  NORMAL_EXCLUDE,
  PERF_GLOBS_JSDOM,
  PERF_GLOBS_NODE,
} from "../../../vitest.shared";
import perfConfig from "../../../vitest.perf.config";

/** Glob → RegExp mínimo (sólo soporta `**` y `*`, suficiente para estos globs). */
function globARegExp(glob: string): RegExp {
  const escapado = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "«DOBLE»")
    .replace(/\*/g, "[^/]*")
    .replace(/«DOBLE»/g, "(?:.*/)?");
  return new RegExp(`^${escapado}$`);
}

const ARCHIVOS_PERF = [
  "src/components/shared/dataTable/__tests__/DataTable.perf.test.tsx",
  "src/lib/algo.perf.ts",
  "src/features/x/Algo.perf.tsx",
];

const ARCHIVOS_NORMALES = [
  "src/lib/algo.test.ts",
  "src/routes/__tests__/routerV7Runtime.test.tsx",
  "src/components/shared/dataTable/__tests__/DataTable.test.tsx",
];

interface ProyectoVitest {
  test?: { name?: string; include?: string[]; setupFiles?: string[] };
}

function proyectos(): ProyectoVitest[] {
  const cfg = perfConfig as { test?: { projects?: ProyectoVitest[] } };
  return cfg.test?.projects ?? [];
}

describe("esArchivoPerf", () => {
  it.each(ARCHIVOS_PERF)("reconoce %s como benchmark", (ruta) => {
    expect(esArchivoPerf(ruta)).toBe(true);
  });

  it.each(ARCHIVOS_NORMALES)("rechaza %s (prueba normal)", (ruta) => {
    expect(esArchivoPerf(ruta)).toBe(false);
  });
});

describe("vitest.perf.config.ts", () => {
  it("declara proyectos perf-node y perf-jsdom", () => {
    const nombres = proyectos().map((p) => p.test?.name);
    expect(nombres).toEqual(["perf-node", "perf-jsdom"]);
  });

  it("sus include son exclusivamente globs de benchmark", () => {
    const includes = proyectos().flatMap((p) => p.test?.include ?? []);
    expect(includes.length).toBeGreaterThan(0);
    for (const glob of includes) expect(glob).toMatch(/\.perf(\.test)?\.tsx?$/);
    expect(includes).toEqual([...PERF_GLOBS_NODE, ...PERF_GLOBS_JSDOM]);
  });

  it("ningún include de perf captura una prueba normal", () => {
    const patrones = proyectos().flatMap((p) => (p.test?.include ?? []).map(globARegExp));
    for (const normal of ARCHIVOS_NORMALES) {
      expect(patrones.some((re) => re.test(normal))).toBe(false);
    }
  });

  it("cada archivo de benchmark queda cubierto por algún include", () => {
    const patrones = proyectos().flatMap((p) => (p.test?.include ?? []).map(globARegExp));
    for (const perf of ARCHIVOS_PERF) {
      expect(patrones.some((re) => re.test(perf))).toBe(true);
    }
  });

  it("carga el guard setup.perf.ts en ambos proyectos", () => {
    for (const p of proyectos()) {
      expect(p.test?.setupFiles).toContain("./src/test/setup.perf.ts");
    }
  });
});

describe("suite normal", () => {
  it("excluye los tres patrones de benchmark", () => {
    expect(NORMAL_EXCLUDE).toContain("src/**/*.perf.ts");
    expect(NORMAL_EXCLUDE).toContain("src/**/*.perf.tsx");
    expect(NORMAL_EXCLUDE).toContain("src/**/*.perf.test.tsx");
  });
});
