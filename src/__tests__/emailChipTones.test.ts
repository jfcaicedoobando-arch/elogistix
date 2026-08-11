/**
 * Guarda de regresión (Sentry JAVASCRIPT-REACT-4X): un `tone` no registrado en
 * `CHIP_TONES` dejaba `colors` en undefined y rompía el render del correo
 * ("Cannot read properties of undefined (reading 'bg')").
 *
 * Se valida por texto (no import) porque las plantillas son módulos Deno con
 * especificadores `npm:` que Vitest no resuelve.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "supabase/functions/_shared/transactional-email-templates";
const LAYOUT_DIR = join(DIR, "_layout");

function tonosRegistrados(): string[] {
  const tokens = readFileSync(join(LAYOUT_DIR, "tokens.ts"), "utf8");
  const bloque = tokens.slice(tokens.indexOf("CHIP_TONES = {"));
  const cuerpo = bloque.slice(0, bloque.indexOf("} as const"));
  return [...cuerpo.matchAll(/^\s*'?([a-z-]+)'?\s*:/gm)].map((m) => m[1]);
}

function tonosUsados(): Array<{ archivo: string; tono: string }> {
  const usos: Array<{ archivo: string; tono: string }> = [];
  for (const archivo of readdirSync(DIR).filter((f) => f.endsWith(".tsx"))) {
    const src = readFileSync(join(DIR, archivo), "utf8");
    for (const m of src.matchAll(/tone:\s*'([a-z-]+)'/g)) {
      usos.push({ archivo, tono: m[1] });
    }
  }
  return usos;
}

describe("CHIP_TONES de correos transaccionales", () => {
  it("registra los tonos base incluyendo info y warning", () => {
    const tonos = tonosRegistrados();
    expect(tonos).toContain("info");
    expect(tonos).toContain("warning");
    expect(tonos).toContain("factura");
  });

  it("toda plantilla usa un tono registrado", () => {
    const registrados = tonosRegistrados();
    const usos = tonosUsados();
    expect(usos.length).toBeGreaterThan(0);
    const faltantes = usos.filter((u) => !registrados.includes(u.tono));
    expect(faltantes).toEqual([]);
  });

  it("expone un tono por omisión como blindaje", () => {
    const tokens = readFileSync(join(LAYOUT_DIR, "tokens.ts"), "utf8");
    expect(tokens).toContain("CHIP_TONE_FALLBACK");
    const layout = readFileSync(join(LAYOUT_DIR, "EmailLayout.tsx"), "utf8");
    expect(layout).toContain("?? CHIP_TONE_FALLBACK");
  });
});
