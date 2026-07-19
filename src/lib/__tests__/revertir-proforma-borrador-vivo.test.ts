/**
 * Guardrail Fase R.7 (Bug 3 residual): la última definición de
 * `revertir_proforma_al_cancelar_sustitucion` NO debe excluir `'Borrador'` al
 * contar facturas vivas — los borradores consumen conceptos y bloquean la
 * liberación de la proforma. Simétrico a lo que ya hace Fase C.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATIONS_DIR = resolve(process.cwd(), "supabase/migrations");

function findLatestBody(): string {
  const files = readdirSync(MIGRATIONS_DIR).sort();
  let latest = "";
  for (const f of files) {
    const body = readFileSync(resolve(MIGRATIONS_DIR, f), "utf8");
    if (
      /FUNCTION\s+public\.revertir_proforma_al_cancelar_sustitucion\b/i.test(body)
    ) {
      latest = body;
    }
  }
  return latest;
}

describe("revertir_proforma_al_cancelar_sustitucion cuenta borradores como vivos", () => {
  const body = findLatestBody();

  it("existe al menos una migración que redefine la RPC (borrador-vivo)", () => {
    expect(body.length).toBeGreaterThan(0);
  });

  it("la última definición NO excluye 'Borrador' del check de facturas vivas", () => {
    // Extraer sólo el bloque más reciente de la función
    const idx = body.lastIndexOf("revertir_proforma_al_cancelar_sustitucion");
    const slice = body.slice(idx);
    // El NOT IN debe listar sólo Cancelada y Sustituida
    expect(slice).toMatch(
      /NOT\s+IN\s*\(\s*'Cancelada'\s*,\s*'Sustituida'\s*\)/i,
    );
    expect(slice).not.toMatch(
      /NOT\s+IN\s*\(\s*'Cancelada'\s*,\s*'Sustituida'\s*,\s*'Borrador'/i,
    );
  });
});
