/**
 * Guardarraíl Ola 5 · 5.6 — un solo criterio para colorear márgenes.
 *
 * El tono de un porcentaje de margen debe salir de `@/lib/ui/margen`
 * (`tonoMargen` / `claseTonoMargen`) o del componente
 * `<MargenBadge />` / `<MargenTexto />`. Está prohibido volver a decidir el
 * color con un ternario sobre la variable de margen.
 */
import { describe, it, expect } from "vitest";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { walk, relPath } from "../../../scripts/lib/walk";

const ROOT = resolve(__dirname, "../../..");

/** Archivos autorizados a definir el mapeo (la fuente de verdad misma). */
const PERMITIDOS = new Set(["src/lib/ui/margen.ts", "src/components/shared/MargenBadge.tsx"]);

/** Inspecciona expresiones, no texto JSX como «Guardar margen</Button>». */
function coloresMargenInline(source: string): string[] {
  const file = ts.createSourceFile("component.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const matches: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isConditionalExpression(node)
      && /\bmargen\w*\s*[<>]=?/i.test(node.condition.getText(file))
      && /text-(success|warning|destructive)/.test(`${node.whenTrue.getText(file)} ${node.whenFalse.getText(file)}`)) {
      matches.push(node.getText(file).replace(/\s+/g, " ").slice(0, 120));
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return matches;
}

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
      const matches = coloresMargenInline(readFileSync(f, "utf8"));
      for (const match of matches) ofensores.push(`${rel}: ${match}`);
    }
    expect(
      ofensores,
      "Usa <MargenBadge />/<MargenTexto /> o claseTonoMargen() de @/lib/ui/margen:\n" +
        ofensores.join("\n"),
    ).toEqual([]);
  });

  it("detecta ternarios en varias líneas sin confundir texto JSX con comparaciones", () => {
    expect(coloresMargenInline('const c = margenPct < 0 ? "text-destructive" : "text-success";')).toHaveLength(1);
    expect(coloresMargenInline('const c = margenPct\n >= minimo\n ? "text-success" : "text-warning";')).toHaveLength(1);
    expect(coloresMargenInline('<><Button>Guardar margen</Button>{!valido && <p className="text-destructive">Inválido</p>}</>')).toEqual([]);
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
