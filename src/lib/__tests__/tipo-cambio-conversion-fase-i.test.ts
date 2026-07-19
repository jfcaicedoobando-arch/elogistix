/**
 * Guardrail Fase I (v13.301.80) — TC obligatorio en facturas Borrador extranjeras.
 *
 * Blinda que:
 *  - La migración crea el trigger `trg_factura_tc_extranjera_obligatorio` sobre
 *    `public.facturas` en `BEFORE INSERT`.
 *  - La función asociada anula `tipo_cambio` cuando `moneda <> 'MXN'`, `estado = 'Borrador'`
 *    y `tipo_cambio = 1` — sin tocar MXN.
 *  - Se ejecuta el backfill defensivo (`UPDATE ... SET tipo_cambio = NULL`).
 *  - El edge function `facturapi-emitir` rechaza `tipo_cambio === 1` para moneda distinta
 *    a MXN.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readLatestTcMigration(): string {
  const dir = path.resolve(__dirname, "../../../supabase/migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().reverse();
  for (const f of files) {
    const body = fs.readFileSync(path.join(dir, f), "utf8");
    if (body.includes("trg_factura_tc_extranjera_obligatorio")) return body;
  }
  throw new Error("No se encontró migración con trg_factura_tc_extranjera_obligatorio");
}

describe("Fase I — tipo de cambio obligatorio en facturas extranjeras", () => {
  const sql = readLatestTcMigration();

  it("crea la función del trigger y registra BEFORE INSERT sobre facturas", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.trg_factura_tc_extranjera_obligatorio/);
    expect(sql).toMatch(/BEFORE INSERT ON public\.facturas[\s\S]*trg_factura_tc_extranjera_obligatorio/);
  });

  it("anula TC=1 sólo para moneda extranjera en estado Borrador", () => {
    expect(sql).toMatch(/moneda\s*<>\s*'MXN'::public\.moneda/);
    expect(sql).toMatch(/estado\s*=\s*'Borrador'::estado_factura/);
    expect(sql).toMatch(/tipo_cambio\s*=\s*1/);
    expect(sql).toMatch(/NEW\.tipo_cambio\s*:=\s*NULL/);
  });

  it("aplica backfill: UPDATE ... SET tipo_cambio = NULL", () => {
    expect(sql).toMatch(/UPDATE public\.facturas[\s\S]*SET tipo_cambio\s*=\s*NULL[\s\S]*moneda\s*<>\s*'MXN'/);
  });

  it("edge function facturapi-emitir rechaza TC === 1 para moneda no-MXN", () => {
    const fnPath = path.resolve(__dirname, "../../../supabase/functions/facturapi-emitir/index.ts");
    const body = fs.readFileSync(fnPath, "utf8");
    expect(body).toMatch(/tcFactura\s*===\s*1/);
    expect(body).toMatch(/tipo_cambio_requerido/);
  });
});
