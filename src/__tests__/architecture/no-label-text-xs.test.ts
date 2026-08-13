/**
 * Guardrail UX-08 — el tamaño del label es la variante `size` del primitivo
 * (`src/components/ui/label.tsx`), no un `className="text-xs"` suelto.
 * Etiquetas de formulario: `<Label>` sin clases (text-sm por defecto).
 * Micro-labels de filas editables: `<Label size="sm">`.
 *
 * La deuda `LABEL_TEXT_XS_DEBT` nace VACÍA tras la migración de la Ola 11 y
 * no debe crecer: si aparece un caso legítimo, documéntalo aquí con la razón.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { walk, relPath } from "../../../scripts/lib/walk";

const ROOT = resolve(__dirname, "../../..");
/** `<Label … className="…text-xs…">` — con o sin clases adicionales. */
const LABEL_TEXT_XS = /<Label\b[^>]*className="[^"]*\btext-xs\b/;

/** Deuda congelada (UX-08): vacía; sólo puede decrecer, nunca crecer. */
const LABEL_TEXT_XS_DEBT: readonly string[] = [];

describe("architecture — no <Label className=text-xs> (UX-08)", () => {
  it("ningún Label lleva text-xs por className fuera de la deuda congelada", () => {
    const violations: string[] = [];
    for (const f of walk(join(ROOT, "src"), {
      excludeDirs: ["__tests__", "node_modules"],
      excludeFileRe: /\.(test|spec)\.tsx?$/,
    })) {
      if (!f.endsWith(".tsx")) continue;
      const src = readFileSync(f, "utf8");
      if (!LABEL_TEXT_XS.test(src)) continue;
      const rel = relPath(ROOT, f);
      if (!LABEL_TEXT_XS_DEBT.includes(rel)) violations.push(rel);
    }
    expect(
      violations,
      `Labels con className="text-xs" detectados. Usa <Label> (text-sm por\n` +
        `defecto) o <Label size="sm"> para micro-labels de filas editables.\n\n` +
        violations.join("\n"),
    ).toEqual([]);
  });

  it("no hay entradas obsoletas en la deuda congelada", () => {
    const stale: string[] = [];
    for (const rel of LABEL_TEXT_XS_DEBT) {
      try {
        const src = readFileSync(join(ROOT, rel), "utf8");
        if (!LABEL_TEXT_XS.test(src)) stale.push(rel);
      } catch {
        stale.push(`${rel} (no existe)`);
      }
    }
    expect(
      stale,
      `Entradas en LABEL_TEXT_XS_DEBT que ya no usan text-xs (o no existen).\n` +
        `Elimínalas de la lista.\n\n` +
        stale.join("\n"),
    ).toEqual([]);
  });
});
