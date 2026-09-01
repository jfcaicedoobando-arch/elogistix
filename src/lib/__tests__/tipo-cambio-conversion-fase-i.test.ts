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

  it("la banda fiscal compartida rechaza TC = 1 para moneda no-MXN", async () => {
    // v13.821.1 — La validación dejó de ser un `tcFactura === 1` escrito dentro
    // de `facturapi-emitir`: hoy vive en la banda canónica compartida
    // (`_shared/tcBanda.ts`, 5..40 MXN por divisa), que también cubre TC = 1.
    // Se prueba el comportamiento, no el texto.
    const { validarTcFiscal, TC_MXN_MIN, TC_MXN_MAX } = await import(
      "../../../supabase/functions/_shared/tcBanda.ts"
    );
    expect(validarTcFiscal("MXN", 1)).toBeNull();
    expect(validarTcFiscal("USD", 1)).toMatch(/tipo de cambio inválido/i);
    expect(validarTcFiscal("USD", null)).toMatch(/tipo de cambio inválido/i);
    expect(validarTcFiscal("USD", TC_MXN_MIN - 0.01)).not.toBeNull();
    expect(validarTcFiscal("USD", TC_MXN_MAX + 0.01)).not.toBeNull();
    expect(validarTcFiscal("USD", 18.5)).toBeNull();
  });

  it("facturapi-emitir usa la banda y responde 422 tipo_cambio_requerido", () => {
    const emitir = fs.readFileSync(
      path.resolve(__dirname, "../../../supabase/functions/facturapi-emitir/emitir.ts"),
      "utf8",
    );
    expect(emitir).toMatch(/validarTcFiscal\(\s*monedaFactura,\s*factura\.tipo_cambio\s*\)/);
    expect(emitir).toMatch(/error:\s*"tipo_cambio_requerido"[\s\S]{0,120}422/);
  });
});

