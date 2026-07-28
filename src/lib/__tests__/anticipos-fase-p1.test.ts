/**
 * Guardrail Fase P.1 (v13.301.87) — Modelo de anticipos a proveedor.
 *
 * Blinda que la migración que introduce el sistema de anticipos incluya:
 *  - Tablas `anticipos_proveedor` y `anticipos_aplicaciones` con GRANTs, RLS
 *    y policies scoped por organización.
 *  - Columna `pagos_proveedor.es_anticipo_aplicado` con default false.
 *  - Trigger `trg_anticipo_saldo` sobre `anticipos_aplicaciones` que mantiene
 *    saldo_disponible/estado sincronizados.
 *  - RPCs SECURITY DEFINER (`registrar_anticipo_proveedor`,
 *    `aplicar_anticipo_a_factura`, `cancelar_anticipo_proveedor`) con
 *    validaciones de rol, saldo y consistencia.
 *  - REVOKE de PUBLIC/anon + GRANT restringido a authenticated/service_role.
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

describe("Fase P.1 — Anticipos a proveedor", () => {
  // v13.320.35: usamos un marker exclusivo de la migración seed de Fase P.1.
  // El marker anterior (`aplicar_anticipo_a_factura`) también aparecía en
  // hotfixes posteriores del RPC (p.ej. B-060 v13.320.32), lo que hacía que el
  // guardrail leyera la migración equivocada y fallara con un falso positivo.
  const sql = readLatestContaining("CREATE TABLE IF NOT EXISTS public.anticipos_proveedor");

  it("crea la tabla anticipos_proveedor con estados válidos y grants correctos", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.anticipos_proveedor/);
    expect(sql).toMatch(
      /CHECK \(estado IN \('disponible','aplicado_parcial','aplicado_total','cancelado'\)\)/,
    );
    expect(sql).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON public\.anticipos_proveedor TO authenticated/);
    expect(sql).toMatch(/GRANT ALL ON public\.anticipos_proveedor TO service_role/);
    expect(sql).toMatch(/ALTER TABLE public\.anticipos_proveedor ENABLE ROW LEVEL SECURITY/);
  });

  it("crea la tabla anticipos_aplicaciones (bridge) con grants y RLS", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.anticipos_aplicaciones/);
    expect(sql).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE ON public\.anticipos_aplicaciones TO authenticated/,
    );
    expect(sql).toMatch(/ALTER TABLE public\.anticipos_aplicaciones ENABLE ROW LEVEL SECURITY/);
  });

  it("todas las policies aíslan por organización o super_admin", () => {
    const policies = sql.match(/CREATE POLICY "anticipos_[a-z_]+"/g) ?? [];
    expect(policies.length).toBeGreaterThanOrEqual(8); // 4 tablas × 2 (min)
    expect(sql).toMatch(
      /organization_id = public\.current_user_org_id\(\)\s*\n?\s*OR public\.has_role\(auth\.uid\(\),'super_admin'::app_role\)/,
    );
  });

  it("marca pagos_proveedor.es_anticipo_aplicado con default false", () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.pagos_proveedor\s+ADD COLUMN IF NOT EXISTS es_anticipo_aplicado boolean NOT NULL DEFAULT false/,
    );
  });

  it("instala el trigger trg_anticipo_saldo en anticipos_aplicaciones", () => {
    expect(sql).toMatch(
      /CREATE TRIGGER trg_anticipo_saldo\s+AFTER INSERT OR UPDATE OR DELETE ON public\.anticipos_aplicaciones/,
    );
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\._recalc_anticipo_saldo\(p_anticipo_id uuid\)/);
  });

  it("las 3 RPCs son SECURITY DEFINER con search_path fijo", () => {
    for (const fn of [
      "registrar_anticipo_proveedor",
      "aplicar_anticipo_a_factura",
      "cancelar_anticipo_proveedor",
    ]) {
      const re = new RegExp(
        `CREATE OR REPLACE FUNCTION public\\.${fn}\\([\\s\\S]*?SECURITY DEFINER[\\s\\S]*?SET search_path = public`,
      );
      expect(sql).toMatch(re);
    }
  });

  it("valida rol autorizado en cada RPC (has_role o user_roles)", () => {
    const roleCheck = /'admin','admin_org','super_admin','contador','tesorero'/g;
    const matches = sql.match(roleCheck) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3); // 1 por RPC
    expect(sql).toMatch(/LC_ANTICIPO_SIN_ROL/);
  });

  it("valida saldo disponible con tolerancia 0.01 al aplicar", () => {
    expect(sql).toMatch(/saldo_disponible \+ 0\.01 < p_monto/);
    expect(sql).toMatch(/LC_ANTICIPO_SIN_SALDO/);
  });

  it("bloquea cancelar anticipo con aplicaciones vivas", () => {
    expect(sql).toMatch(/LC_ANTICIPO_CON_APLICACIONES/);
    expect(sql).toMatch(/FROM public\.anticipos_aplicaciones\s+WHERE anticipo_id = p_id AND deleted_at IS NULL/);
  });

  it("revoca EXECUTE de PUBLIC/anon y otorga a authenticated + service_role (RPCs anticipos)", () => {
    for (const fn of [
      "registrar_anticipo_proveedor\\(uuid,numeric,public\\.moneda,date,numeric,text,text,uuid,text\\)",
      "aplicar_anticipo_a_factura\\(uuid,uuid,numeric,date\\)",
      "cancelar_anticipo_proveedor\\(uuid,text\\)",
    ]) {
      expect(sql).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn} FROM PUBLIC, anon`));
      expect(sql).toMatch(
        new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn} TO authenticated, service_role`),
      );
    }
  });
});
