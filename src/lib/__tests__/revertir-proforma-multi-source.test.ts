/**
 * Guardrail v13.301.70 (Fase B, Bug 1): la RPC
 * `revertir_proforma_al_cancelar_sustitucion` debe poder liberar proformas
 * cuando la factura es multi-proforma (facturas.proforma_id IS NULL). Para
 * eso está obligada a leer `conceptos_factura.proforma_id_origen`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATIONS_DIR = resolve(process.cwd(), "supabase/migrations");

function findLatestRevertirBody(): string {
  const files = readdirSync(MIGRATIONS_DIR).sort();
  let latest = "";
  for (const f of files) {
    const body = readFileSync(resolve(MIGRATIONS_DIR, f), "utf8");
    if (
      /FUNCTION\s+public\.revertir_proforma_al_cancelar_sustitucion\b/i.test(
        body,
      )
    ) {
      latest = body;
    }
  }
  return latest;
}

describe("revertir_proforma_al_cancelar_sustitucion resuelve multi-proforma", () => {
  const body = findLatestRevertirBody();

  it("existe al menos una migración que redefine la RPC", () => {
    expect(body.length).toBeGreaterThan(0);
  });

  it("la última definición referencia conceptos_factura.proforma_id_origen", () => {
    expect(body).toMatch(/conceptos_factura[\s\S]{0,200}proforma_id_origen/i);
  });

  it("retorna uuid[] para soportar múltiples proformas liberadas", () => {
    expect(body).toMatch(
      /FUNCTION\s+public\.revertir_proforma_al_cancelar_sustitucion[\s\S]*?RETURNS\s+uuid\[\]/i,
    );
  });

  it("verifica facturas vivas antes de liberar cada proforma", () => {
    expect(body).toMatch(/NOT\s+IN\s*\(\s*'Cancelada'\s*,\s*'Sustituida'/i);
  });
});
