/**
 * Anti-regresión M14 (auditoría arquitectura 2026-07-29).
 *
 * 1. Los componentes de feature no deben declarar `useQuery({` / `useMutation({`
 *    inline: la lógica de datos vive en `hooks/` del feature (testeable y
 *    con invalidaciones centralizadas). El baseline es 0 y sólo puede bajar.
 * 2. No deben existir archivos `use*.ts(x)` bajo `components/`: los hooks
 *    viven en la carpeta `hooks/` de su feature.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const FEATURES_DIR = join(process.cwd(), "src", "features");
/** Baseline de llamadas inline permitidas. Sólo puede bajar, nunca subir. */
const BASELINE_INLINE = 0;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

function componentFiles(): string[] {
  const archivos: string[] = [];
  for (const feature of readdirSync(FEATURES_DIR)) {
    const dir = join(FEATURES_DIR, feature, "components");
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
    archivos.push(...walk(dir));
  }
  return archivos.filter((f) => !f.includes("__tests__"));
}

describe("arquitectura · lógica de datos fuera de components/", () => {
  it("no hay useQuery/useMutation inline en src/features/*/components/**", () => {
    const infractores: string[] = [];
    for (const file of componentFiles()) {
      const src = readFileSync(file, "utf8");
      if (/\buse(Query|Mutation)\(\{/.test(src)) {
        infractores.push(file.replace(process.cwd() + "/", ""));
      }
    }
    expect(
      infractores.length,
      `Extrae la lógica de datos a hooks/ del feature:\n${infractores.join("\n")}`,
    ).toBeLessThanOrEqual(BASELINE_INLINE);
  });

  it("no hay archivos use*.ts(x) bajo components/", () => {
    const hooks = componentFiles().filter((f) => /^use[A-Z]/.test(basename(f)));
    expect(
      hooks.map((f) => f.replace(process.cwd() + "/", "")),
      "Mueve estos hooks a la carpeta hooks/ de su feature",
    ).toEqual([]);
  });

  /**
   * P1-B — Las cuatro rutas de Compras migradas a hooks controladores no
   * pueden volver a declarar queries/mutaciones inline. Se listan una por una
   * (burn-down incremental): cuando se migren otras rutas, agréguelas aquí.
   */
  it("las 4 rutas migradas de Compras no usan useQuery/useMutation", () => {
    const RUTAS_MIGRADAS = [
      "src/features/compras/routes/ComprasReportes.tsx",
      "src/features/compras/routes/ComprasNotasCredito.tsx",
      "src/features/compras/routes/ComprasPagos.tsx",
      "src/features/compras/routes/ComprasConciliacion.tsx",
    ];
    const infractores: string[] = [];
    for (const rel of RUTAS_MIGRADAS) {
      const abs = join(process.cwd(), rel);
      expect(existsSync(abs), `${rel} no existe`).toBe(true);
      const src = readFileSync(abs, "utf8");
      if (/\buse(Query|Mutation|InfiniteQuery)\b/.test(src)) infractores.push(rel);
    }
    expect(
      infractores,
      "La coordinación de datos vive en src/features/compras/hooks/*Controller.ts",
    ).toEqual([]);
  });
});

