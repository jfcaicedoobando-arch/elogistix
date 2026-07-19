/**
 * Guardrail Fase N (v13.301.85) — Recálculo automático del estado de factura
 * proveedor por trigger BD (Bugs 21 y 22).
 *
 * Blinda que la última migración que instala
 * `tg_recalcular_estado_factura_proveedor` incluya:
 *  - Helper `_recalc_estado_proveedor_factura(uuid)` con tolerancia 0.01
 *    y respeto a Cancelada/Borrador.
 *  - Triggers AFTER INSERT/UPDATE/DELETE en `pagos_proveedor` y en
 *    `proveedor_notas_credito`.
 *  - REVOKE de PUBLIC + GRANT restringido en el helper.
 *  - Backfill que sólo mueve Vigente → Pagada.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIG_DIR = path.resolve(__dirname, "../../../supabase/migrations");

function readLatestContaining(marker: string): string {
  const files = fs.readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql")).sort().reverse();
  for (const f of files) {
    const body = fs.readFileSync(path.join(MIG_DIR, f), "utf8");
    if (body.includes(marker)) return body;
  }
  throw new Error(`No se encontró migración con marker: ${marker}`);
}

describe("Fase N — Recálculo automático estado factura proveedor", () => {
  const sql = readLatestContaining("tg_recalcular_estado_factura_proveedor");

  it("existe el helper puro `_recalc_estado_proveedor_factura(uuid)`", () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\._recalc_estado_proveedor_factura\(p_factura_id uuid\)/,
    );
  });

  it("respeta Cancelada y Borrador (nunca se reabren)", () => {
    expect(sql).toMatch(/estado IN \('Cancelada','Borrador'\)/);
  });

  it("usa la tolerancia de 0.01 para clasificar Pagada vs Vigente", () => {
    expect(sql).toMatch(/v_saldo\s*<=\s*0\.01/);
  });

  it("registra trigger AFTER en pagos_proveedor y en proveedor_notas_credito", () => {
    expect(sql).toMatch(
      /CREATE TRIGGER trg_pagos_proveedor_recalcular_estado[\s\S]*AFTER INSERT OR UPDATE OR DELETE ON public\.pagos_proveedor/,
    );
    expect(sql).toMatch(
      /CREATE TRIGGER trg_notas_credito_prov_recalcular_estado[\s\S]*AFTER INSERT OR UPDATE OR DELETE ON public\.proveedor_notas_credito/,
    );
  });

  it("REVOKE de PUBLIC y GRANT restringido en el helper", () => {
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\._recalc_estado_proveedor_factura\(uuid\) FROM PUBLIC/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\._recalc_estado_proveedor_factura\(uuid\) TO authenticated, service_role/,
    );
  });

  it("backfill sólo mueve Vigente → Pagada (nunca reabre Pagadas)", () => {
    expect(sql).toMatch(
      /UPDATE public\.proveedor_facturas[\s\S]*SET estado = 'Pagada'[\s\S]*WHERE[\s\S]*estado = 'Vigente'/,
    );
    expect(sql).not.toMatch(/SET estado = 'Vigente'[\s\S]*WHERE[\s\S]*estado = 'Pagada'/);
  });
});
