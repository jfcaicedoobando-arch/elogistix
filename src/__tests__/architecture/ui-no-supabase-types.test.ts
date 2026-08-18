/**
 * Anti-regresión (auditoría 2026-08-18 · punto 2).
 *
 * Los componentes de UI no deben importar `@/integrations/supabase/types`
 * (esquema físico). Deben usar un alias de dominio del feature (`types/`,
 * `domain/`) o el shim `@/types/db`, para que una migración de columnas se
 * absorba en un solo archivo y no rompa pantallas.
 *
 * Baseline = 0: sólo puede mantenerse, nunca subir.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const FEATURES_DIR = join(process.cwd(), "src", "features");
const BASELINE = 0;

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

describe("arquitectura · UI desacoplada del esquema de base de datos", () => {
  it("ningún componente importa @/integrations/supabase/types", () => {
    const infractores = componentFiles().filter((file) =>
      readFileSync(file, "utf8").includes("@/integrations/supabase/types"),
    );
    const relativos = infractores.map((f) => f.replace(`${process.cwd()}/`, ""));
    expect(relativos, `Usa un alias de dominio del feature o @/types/db:\n${relativos.join("\n")}`)
      .toHaveLength(BASELINE);
  });
});
