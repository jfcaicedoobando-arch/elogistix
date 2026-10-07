import fs from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPath = "supabase/migrations/20261007023000_audit99_121_historial_ajustes_no_monetarios.sql";
const migration = fs.readFileSync(migrationPath, "utf8");
const guardPath = "supabase/tests/audit99_121_historial_ajustes.sql";
const guard = fs.readFileSync(guardPath, "utf8");

describe("AUD99/121 · migración lectora y cobertura registrada", () => {
  it("reemplaza la función sin DROP, DML de negocio ni cambio de firma o owner", () => {
    const sql = migration.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.historial_proveedor_factura(p_id uuid)");
    expect(sql).toMatch(/RETURNS TABLE\(ts timestamp with time zone, tipo text, descripcion text, actor_email text, monto numeric, moneda text, detalles jsonb\)/);
    expect(sql).not.toMatch(/\b(?:DROP|UPDATE|INSERT INTO|DELETE FROM|OWNER TO)\b/i);
    expect(sql).toContain("FROM PUBLIC, anon;");
    expect(sql).toContain("TO authenticated, service_role;");
  });

  it("expone valores persistidos sin inferir por la referencia ni certificar datos genéricos", () => {
    expect(migration).toContain("CASE WHEN pp.es_ajuste THEN 'Ajuste no monetario registrado'");
    expect(migration).toContain("'pago_id', pp.id, 'es_ajuste', pp.es_ajuste, 'motivo_ajuste', pp.motivo_ajuste");
    expect(migration).toContain("pp.organization_id = v_org AND pp.deleted_at IS NULL");
    expect(migration).not.toMatch(/pp\.referencia\s+(?:ILIKE|LIKE|~)/);
    expect(migration).toContain("b.evento_verificado");
  });

  it("registra la suite de motivos, pagos, baja lógica y aislamiento sin skips", () => {
    expect(fs.readFileSync("supabase/tests/_guards_manifest.txt", "utf8").split("\n")).toContain(guardPath);
    expect(guard).toContain("ARRAY['compensacion', 'condonacion', 'ajuste_historico', 'duplicada']");
    expect(guard).toContain("SET deleted_at = now()");
    expect(guard).toContain("pg_temp.as_user(fx.admin_b)");
    expect(guard).toContain("pg_temp.assert_max_skips(0)");
    expect(guard).toContain("ROLLBACK;");
  });
});
