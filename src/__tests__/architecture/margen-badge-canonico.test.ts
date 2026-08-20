/**
 * Guardarraíl Ola 5 · 5.6 — un solo criterio para colorear márgenes.
 *
 * El tono de un porcentaje de margen debe salir de `@/lib/ui/margen`
 * (`tonoMargen` / `claseTonoMargen`) o del componente
 * `<MargenBadge />` / `<MargenTexto />`. Está prohibido volver a decidir el
 * color con un ternario sobre la variable de margen.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { walk, relPath } from "../../../scripts/lib/walk";

const ROOT = resolve(__dirname, "../../..");

/** Archivos autorizados a definir el mapeo (la fuente de verdad misma). */
const PERMITIDOS = new Set(["src/lib/ui/margen.ts", "src/components/shared/MargenBadge.tsx"]);

/**
 * `margen... < 0 ? "text-destructive" : ...`.
 * Ola C · C.4 (R3-V-4): se evalúa sobre el archivo con espacios colapsados,
 * así un ternario partido en varias líneas ya no esquiva el guardarraíl.
 */
const TERNARIO_MARGEN = /margen\w*\s*[<>]=?.{0,100}?text-(success|warning|destructive)/i;

describe("architecture — MargenBadge canónico (5.6)", () => {
  it("ningún componente decide el color del margen a mano", () => {
    const ofensores: string[] = [];
    for (const f of walk(join(ROOT, "src"), {
      excludeDirs: ["__tests__", "node_modules"],
      excludeFileRe: /\.(test|spec)\.tsx?$/,
    })) {
      if (!/\.tsx?$/.test(f)) continue;
      const rel = relPath(ROOT, f);
      if (PERMITIDOS.has(rel)) continue;
      const src = readFileSync(f, "utf8").replace(/\s+/g, " ");
      const m = TERNARIO_MARGEN.exec(src);
      if (m) ofensores.push(`${rel}: ${m[0].slice(0, 120)}`);
    }
    expect(
      ofensores,
      "Usa <MargenBadge />/<MargenTexto /> o claseTonoMargen() de @/lib/ui/margen:\n" +
        ofensores.join("\n"),
    ).toEqual([]);
  });

  it("el helper eliminado getProfitToneClass no reaparece", () => {
    const ofensores: string[] = [];
    for (const f of walk(join(ROOT, "src"), { excludeDirs: ["node_modules"] })) {
      if (!/\.tsx?$/.test(f)) continue;
      const src = readFileSync(f, "utf8");
      if (new RegExp("export const get" + "ProfitToneClass").test(src)) ofensores.push(relPath(ROOT, f));
    }
    expect(ofensores).toEqual([]);
  });
});
