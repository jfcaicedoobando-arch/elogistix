/**
 * Guardrail Fase D (v13.301.73) — definición única de "factura viva" con NCs.
 *
 * v13.823.299: la arquitectura evolucionó. El cálculo canónico vive en
 * `_saldo_factura_calc(uuid)` (helper SECURITY DEFINER sin ACL) y las
 * envolturas `saldo_factura(uuid)` / `saldo_factura_bruto(uuid)` añaden la
 * validación de tenencia multi-tenant/portal. Este test blinda ese contrato.
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
  const faseD = readMigration("20260722013500_faseD_reconsolidada_v13_305_10.sql");
  const calcSql = readLatestMigrationWith(
    "CREATE OR REPLACE FUNCTION public._saldo_factura_calc(p_factura_id uuid)",
  );
  const aclSql = readLatestMigrationWith(
    "CREATE OR REPLACE FUNCTION public.saldo_factura(p_factura_id uuid)",
  );
  const brutoSql = readLatestMigrationWith(
    "CREATE OR REPLACE FUNCTION public.saldo_factura_bruto(p_factura_id uuid)",
  );
  const validarSql = readLatestMigrationWith(
    "CREATE OR REPLACE FUNCTION public.validar_cierre_embarque(p_embarque_id uuid)",
  );
  const recalcSql = readLatestMigrationWith(
    "CREATE OR REPLACE FUNCTION public.recalcular_estado_factura()",
  );

  it("existe el cálculo canónico _saldo_factura_calc(uuid)", () => {
    expect(calcSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\._saldo_factura_calc\(p_factura_id uuid\)/,
    );
  });

  it("saldo_factura y saldo_factura_bruto delegan en _saldo_factura_calc", () => {
    expect(aclSql).toMatch(/RETURN public\._saldo_factura_calc\(p_factura_id\);/);
    expect(brutoSql).toMatch(/RETURN public\._saldo_factura_calc\(p_factura_id\);/);
  });

  it("_saldo_factura_calc devuelve 0 sólo para estados terminales Cancelada/Sustituida", () => {
    expect(calcSql).toMatch(
      /IF v_estado IN \('Cancelada', 'Sustituida'\) THEN RETURN 0;/,
    );
  });

  it("_saldo_factura_calc excluye pagos cuyo REP fue cancelado ante el SAT", () => {
    expect(calcSql).toMatch(/AND NOT public\.pago_rep_anulado\(p\.estado_rep\)/);
  });

  it("_saldo_factura_calc resta notas de crédito aplicadas no borradas", () => {
    expect(calcSql).toMatch(
      /FROM public\.factura_notas_credito[\s\S]{0,200}estado = 'Aplicada'/,
    );
    expect(calcSql).toMatch(
      /RETURN COALESCE\(v_total, 0\) - COALESCE\(v_pagos, 0\) - COALESCE\(v_ncs, 0\);/,
    );
  });

  it("validar_cierre_embarque regla cxc_cobrada evalúa saldo por moneda", () => {
    // La regla CxC compara el saldo por moneda contra 0.01; no compara saldo
    // total mezclado porque sumar USD + MXN ocultaría facturas pendientes.
    expect(validarSql).toMatch(/public\.saldo_factura\(f\.id\)/);
    expect(validarSql).toMatch(
      /WHERE \(m->>'saldo'\)::numeric > 0\.01/,
    );
    // Y expone total, pagado, notas_credito y saldo por moneda.
    expect(validarSql).toMatch(/'notas_credito', notas_credito/);
    expect(validarSql).toMatch(/'saldo', GREATEST\(saldo,0\)/);
  });

  it("cierre y cobro excluyen Sustituida y Borrador (no solo Cancelada)", () => {
    expect(validarSql).toMatch(
      /f\.estado NOT IN \('Cancelada', 'Sustituida', 'Borrador'\)/,
    );
    expect(faseD).toMatch(
      /count\(\*\) FILTER \(WHERE f\.estado NOT IN \('Cancelada','Sustituida','Borrador'\)\)/,
    );
  });

  it("recalcular_estado_factura usa saldo_factura_bruto y excluye pagos anulados", () => {
    // v13.823.294: el trigger usa saldo_factura_bruto (saldo real) en lugar de
    // saldo_factura (que tenía un atajo para facturas Pagadas sin pagos).
    expect(recalcSql).toMatch(/v_saldo := public\.saldo_factura_bruto\(v_factura_id\);/);
    expect(recalcSql).toMatch(
      /COALESCE\(estado_rep, ''\) <> 'Cancelado'/,
    );
  });

  it("recalcular_estado_factura no muta estados terminales", () => {
    expect(recalcSql).toMatch(
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
