import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const leer = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const espejo = leer("supabase/schema/cxp/historial_proveedor_factura.sql");
// AUD-121 vuelve a emitir el RPC y conserva el contrato DATE/timestamp de AUD-F05.
const migracion = leer("supabase/migrations/20261007023000_audit99_121_historial_ajustes_no_monetarios.sql");
const baseline = leer("supabase/schema/baseline.sql");
const cuerpo = (sql: string) => sql.match(/(?:CREATE (?:OR REPLACE )?FUNCTION public\.historial_proveedor_factura)[\s\S]*?AS (\$[\w]*\$)([\s\S]*?)\1;/)?.[2]?.replace(/\s+/g, " ").trim();

describe("AUD-F05 · contrato de fechas del historial CxP", () => {
  it("migration y baseline conservan el mismo cuerpo que el espejo", () => {
    expect(cuerpo(espejo)).toBeTruthy();
    expect(cuerpo(migracion)).toBe(cuerpo(espejo));
    expect(cuerpo(baseline)).toBe(cuerpo(espejo));
  });
  it("consulta fecha DATE explícita y usa created_at para ordenar el registro", () => {
    expect(espejo).toContain("pp.created_at,");
    expect(espejo).toContain("'fecha_pago', pp.fecha_pago");
    expect(espejo).not.toContain("pp.fecha_pago::timestamptz");
    expect(espejo).toContain("ORDER BY e.ev_ts ASC");
  });
  it("no cambia autorización ni amplía el acceso público", () => {
    expect(espejo).toContain("IF v_uid IS NULL");
    expect(espejo).toContain("om.organization_id = v_org AND om.user_id = v_uid");
    expect(migracion).toContain("REVOKE ALL ON FUNCTION public.historial_proveedor_factura(uuid) FROM PUBLIC, anon;");
    expect(migracion).toContain("GRANT EXECUTE ON FUNCTION public.historial_proveedor_factura(uuid) TO authenticated, service_role;");
  });
  it("el guard conductual está en el manifiesto y compara UTC/CDMX con rollback", () => {
    expect(leer("supabase/tests/_guards_manifest.txt")).toContain("supabase/tests/cxp_historial_fecha_pago.sql");
    const test = leer("supabase/tests/cxp_historial_fecha_pago.sql");
    expect(test).toContain("ARRAY['UTC', 'America/Mexico_City']");
    expect(test).toContain("IS DISTINCT FROM v_fecha::text");
    expect(test).toContain("IS DISTINCT FROM v_registro");
    expect(test).toContain("ROLLBACK;");
  });
});
