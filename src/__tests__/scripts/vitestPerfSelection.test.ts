/**
 * Protección de la selección de `bun run test:perf`.
 *
 * Antes, `vitest.perf.config.ts` intentaba sobrescribir `test.include` desde la
 * raíz, pero los proyectos node/jsdom traían su propio `include` y ganaban: el
 * comando corría la suite normal y ningún benchmark. Estas pruebas fallan si
 * alguien vuelve a mezclar ambos conjuntos.
 *
 * El config NO se importa (cargarlo arrastra el plugin de Vite/esbuild, que no
 * funciona dentro del entorno de test); se inspecciona su fuente más los globs
 * compartidos, que sí son un módulo puro.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  esArchivoPerf,
  NORMAL_EXCLUDE,
  PERF_EXCLUDE,
  PERF_GLOBS_JSDOM,
  PERF_GLOBS_NODE,
} from "../../../vitest.shared";

const raiz = process.cwd();
const perfSrc = fs.readFileSync(path.join(raiz, "vitest.perf.config.ts"), "utf8");
/** Fuente sin comentarios: los comentarios explican el patrón viejo. */
const perfCodigo = perfSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

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

const GLOBS_PERF = [...PERF_GLOBS_NODE, ...PERF_GLOBS_JSDOM];
const PATRONES = GLOBS_PERF.map(globARegExp);

describe("esArchivoPerf", () => {
  it.each(ARCHIVOS_PERF)("reconoce %s como benchmark", (ruta) => {
    expect(esArchivoPerf(ruta)).toBe(true);
  });

  it.each(ARCHIVOS_NORMALES)("rechaza %s (prueba normal)", (ruta) => {
    expect(esArchivoPerf(ruta)).toBe(false);
  });
});

describe("globs de benchmark", () => {
  it("todos apuntan a archivos *.perf.*", () => {
    expect(GLOBS_PERF.length).toBeGreaterThan(0);
    for (const glob of GLOBS_PERF) expect(glob).toMatch(/\.perf(\.test)?\.tsx?$/);
  });

  it("ninguno captura una prueba normal", () => {
    for (const normal of ARCHIVOS_NORMALES) {
      expect(PATRONES.some((re) => re.test(normal))).toBe(false);
    }
  });

  it("cubren todos los archivos de benchmark", () => {
    for (const perf of ARCHIVOS_PERF) {
      expect(PATRONES.some((re) => re.test(perf))).toBe(true);
    }
  });

  it("cubren los benchmarks reales del repo", () => {
    const encontrados: string[] = [];
    const caminar = (dir: string): void => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === "node_modules") continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) caminar(full);
        else if (/\.perf(\.test)?\.tsx?$/.test(e.name)) {
          encontrados.push(path.relative(raiz, full).split(path.sep).join("/"));
        }
      }
    };
    caminar(path.join(raiz, "src"));
    expect(encontrados.length).toBeGreaterThan(0);
    for (const perf of encontrados) {
      expect(PATRONES.some((re) => re.test(perf))).toBe(true);
    }
  });
});

describe("vitest.perf.config.ts", () => {
  it("declara proyectos propios en lugar de sobreescribir el include raíz", () => {
    expect(perfSrc).toContain('name: "perf-node"');
    expect(perfSrc).toContain('name: "perf-jsdom"');
    expect(perfCodigo).not.toMatch(/mergeConfig\s*\(/);
  });

  it("toma los include de los globs compartidos", () => {
    expect(perfSrc).toContain("PERF_GLOBS_NODE");
    expect(perfSrc).toContain("PERF_GLOBS_JSDOM");
  });

  it("carga el guard setup.perf.ts en ambos proyectos", () => {
    const ocurrencias = perfSrc.split("./src/test/perfGuard.setup.ts").length - 1;
    expect(ocurrencias).toBe(2);
  });

  it("perf no excluye benchmarks (el filtro lo hace include)", () => {
    for (const patron of PERF_EXCLUDE) expect(patron).not.toContain("perf");
  });
});

describe("suite normal", () => {
  it("excluye los tres patrones de benchmark", () => {
    expect(NORMAL_EXCLUDE).toContain("src/**/*.perf.ts");
    expect(NORMAL_EXCLUDE).toContain("src/**/*.perf.tsx");
    expect(NORMAL_EXCLUDE).toContain("src/**/*.perf.test.tsx");
  });
});
