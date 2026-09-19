/**
 * P0 correctivo — los campos `*_pendiente_*` no deben sobrevivir ni a una
 * liberación de claim ni a una persistencia exitosa: un webhook tardío del
 * intento viejo podría localizar la fila recapturada y promover el CFDI
 * equivocado.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const FN = "supabase/functions";
const MIGR = "supabase/migrations";

function leer(p: string): string {
  return readFileSync(p, "utf8");
}

function sqlConcatenado(): string {
  return readdirSync(MIGR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => leer(join(MIGR, f)))
    .join("\n");
}

describe("limpieza de timbrado pendiente", () => {
  it.each([
    ["factura", `${FN}/facturapi-emitir/emitir.ts`, "facturapi_pendiente_id: null"],
    ["nota de crédito", `${FN}/facturapi-emitir-nota-credito/index.ts`, "facturapi_pendiente_id: null"],
    ["REP", `${FN}/facturapi-emitir-rep/persistir.ts`, "facturapi_rep_pendiente_id: null"],
  ])("la persistencia exitosa de %s limpia el intento pendiente", (_n, archivo, marca) => {
    const src = leer(archivo);
    expect(src).toContain(marca);
    expect(src).toContain(marca.replace("_id: null", "_at: null"));
  });

  it("la liberación de claim de la nota de crédito limpia el pendiente", () => {
    const src = leer(`${FN}/facturapi-recuperar-claim/recuperar.nc.ts`);
    expect(src).toContain("facturapi_pendiente_id: null");
    expect(src).toContain("facturapi_pendiente_at: null");
  });

  it("las RPCs de liberación limpian las columnas pendientes", () => {
    const sql = sqlConcatenado();
    const ultimaFactura = sql.lastIndexOf("liberar_claim_facturapi_huerfano(p_factura_id");
    const ultimoRep = sql.lastIndexOf("liberar_claim_rep_huerfano(p_pago_id");
    expect(ultimaFactura).toBeGreaterThan(-1);
    expect(ultimoRep).toBeGreaterThan(-1);
    expect(sql.slice(ultimaFactura, ultimaFactura + 2500)).toContain("facturapi_pendiente_id = NULL");
    expect(sql.slice(ultimoRep, ultimoRep + 2500)).toContain("facturapi_rep_pendiente_id = NULL");
  });

  it("el webhook escribe con CAS sobre la columna de claim", () => {
    const idx = leer(`${FN}/facturapi-webhook/index.ts`);
    expect(idx).toContain("aplicarPatchConCas");
    expect(idx).not.toMatch(/\.update\(patch\)\s*\n\s*\.eq\("id"/);
    expect(idx).toContain("facturapi_id");
    expect(idx).toContain("facturapi_rep_id");
  });

  it("si no se puede guardar el pendiente se responde 500 recuperable", () => {
    for (const f of [
      `${FN}/facturapi-emitir/pendiente.ts`,
      `${FN}/facturapi-emitir-nota-credito/pendiente.ts`,
      `${FN}/facturapi-emitir-rep/pendiente.ts`,
    ]) {
      const src = leer(f);
      expect(src).toContain("cuerpoPendienteNoPersistido");
      expect(src).toContain("500");
      expect(src).toContain("no_persistido");
    }
  });
});
