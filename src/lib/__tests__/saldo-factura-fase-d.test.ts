/**
 * Guardrail Fase D (v13.301.73) — definición única de "factura viva" con NCs.
 *
 * Blinda que la última migración que redefine `saldo_factura`, `validar_cierre_embarque`,
 * `recalcular_cobro_embarques` y `recalcular_estado_factura`:
 *  - Crea la función pública `saldo_factura(uuid)`.
 *  - Excluye `Cancelada`, `Sustituida` y `Borrador` de las funciones de cierre y cobro
 *    (antes sólo excluía `Cancelada`).
 *  - Resta notas de crédito aplicadas del saldo.
 *  - Recalcula el estado de la factura con base en `saldo_factura` (no sólo pagos).
 *  - Registra el trigger espejo sobre `factura_notas_credito`.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../supabase/migrations");

/** Lee una migración concreta (contrato congelado de Fase D). */
function readMigration(file: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
}

function readLatestMigrationWith(marker: string): string {
  const dir = path.resolve(__dirname, "../../../supabase/migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .reverse();
  for (const f of files) {
    const body = fs.readFileSync(path.join(dir, f), "utf8");
    if (body.includes(marker)) return body;
  }
  throw new Error(`No se encontró migración con: ${marker}`);
}

describe("Fase D — saldo_factura + NCs en cierre y cobro", () => {
  // v13.343.1 — Se separan las dos fuentes: la última migración que redefine
  // `saldo_factura` (puede ser una reparación puntual) y la migración canónica
  // de Fase D que además redefine `validar_cierre_embarque`.
  const sql = readLatestMigrationWith(
    "CREATE OR REPLACE FUNCTION public.saldo_factura(p_factura_id uuid)",
  );
  const faseD = readMigration("20260722013500_faseD_reconsolidada_v13_305_10.sql");


  it("crea la función pública saldo_factura(uuid)", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.saldo_factura\(p_factura_id uuid\)/);
  });

  it("saldo_factura devuelve 0 para estados terminales (incluye Pagada)", () => {
    // v13.743.6 (BUG-2026-08-25): 'Pagada' se sumó a la lista de estados sin saldo
    // porque las facturas legacy migradas sin pagos capturados inflaban el adeudo.
    expect(sql).toMatch(
      /IF v_estado IN \('Cancelada', 'Sustituida', 'Pagada'\) THEN RETURN 0;/,
    );
  });

  it("saldo_factura resta pagos y notas de crédito aplicadas no borradas", () => {
    expect(sql).toMatch(/FROM public\.pagos_factura[\s\S]{0,120}deleted_at IS NULL/);
    expect(sql).toMatch(
      /FROM public\.factura_notas_credito[\s\S]{0,200}estado = 'Aplicada'/,
    );
    expect(sql).toMatch(/RETURN COALESCE\(v_total, 0\) - v_pagos - v_ncs;/);
  });

  it("validar_cierre_embarque regla cxc_cobrada usa saldo_factura", () => {
    // Debe haber una llamada a saldo_factura(f.id) dentro de la sección de regla 6.
    expect(faseD).toMatch(/SUM\(public\.saldo_factura\(f\.id\)\)/);
    // El estado ok se evalúa sobre el saldo (<= 0.01), no sobre total <= pagado.
    expect(faseD).toMatch(/v_ok := \(v_cxc_saldo <= 0\.01\)/);
    // Y el detalle expone total, pagado, notas_credito y saldo.
    expect(faseD).toMatch(/'notas_credito', v_cxc_ncs/);
    expect(faseD).toMatch(/'saldo', v_cxc_saldo/);
  });

  it("cierre y cobro excluyen Sustituida y Borrador (no solo Cancelada)", () => {
    // validar_cierre_embarque: filtro sobre facturas para regla cxc_cobrada.
    expect(faseD).toMatch(
      /f\.estado NOT IN \('Cancelada', 'Sustituida', 'Borrador'\)/,
    );
    // recalcular_cobro_embarques: cuenta total vivas con el mismo filtro.
    expect(faseD).toMatch(
      /count\(\*\) FILTER \(WHERE f\.estado NOT IN \('Cancelada','Sustituida','Borrador'\)\)/,
    );
  });

  it("recalcular_estado_factura considera NCs vía saldo_factura", () => {
    // Trigger recalcula usando saldo_factura, no sólo la suma de pagos.
    expect(faseD).toMatch(/v_saldo := public\.saldo_factura\(v_factura_id\)/);
    expect(faseD).toMatch(/IF v_saldo <= 0\.01 THEN[\s\S]{0,60}v_nuevo_estado := 'Pagada'/);
    // Y respeta Sustituida junto a Cancelada/Borrador (no toca su estado).
    expect(faseD).toMatch(
      /IF v_estado_actual IN \('Cancelada', 'Borrador', 'Sustituida'\) THEN/,
    );
  });

  it("registra trigger espejo sobre factura_notas_credito para recalcular estado", () => {
    expect(faseD).toMatch(/DROP TRIGGER IF EXISTS trg_recalcular_estado_factura_nc/);
    expect(faseD).toMatch(
      /CREATE TRIGGER trg_recalcular_estado_factura_nc[\s\S]{0,200}ON public\.factura_notas_credito/,
    );
    expect(faseD).toMatch(/EXECUTE FUNCTION public\.recalcular_estado_factura\(\)/);
  });

  it("incluye backfill idempotente que respeta facturas ya Pagada/Cancelada/Sustituida", () => {
    // El backfill debe filtrar sólo estados que puedan cambiar a Pagada.
    expect(faseD).toMatch(
      /f\.estado IN \('Emitida', 'Parcialmente pagada', 'Vencida'\)/,
    );
    expect(faseD).toMatch(/public\.saldo_factura\(f\.id\) <= 0\.01/);
  });
});
