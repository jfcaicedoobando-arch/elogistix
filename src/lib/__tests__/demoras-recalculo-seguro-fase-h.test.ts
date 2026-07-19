/**
 * Guardrail Fase H (v13.301.79) — recálculo seguro de demoras.
 *
 * Blinda que la última migración que redefine `calcular_demoras_embarque`:
 *  - Adquiere `pg_advisory_xact_lock` por embarque.
 *  - Levanta `LC_DEMORAS_BLOQUEADAS` cuando hay conceptos en proforma/facturados o
 *    con match en `proveedor_facturas_conceptos`.
 *  - Filtra bloqueo por `estado_facturacion IN ('en_proforma','facturado')`.
 *  - Hace soft-delete (`SET deleted_at = now()`) — no `DELETE FROM ... origen = 'demoras_auto'`.
 *  - Lee la moneda del costo desde `costeo_navieras_condiciones.moneda_demoras` en vez
 *    de hardcodear `'USD'::moneda` en el INSERT de `conceptos_costo`.
 *  - Mantiene el GRANT restrictivo (`authenticated`, `service_role`).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readLatestDemorasMigration(): string {
  const dir = path.resolve(__dirname, "../../../supabase/migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().reverse();
  for (const f of files) {
    const body = fs.readFileSync(path.join(dir, f), "utf8");
    if (body.includes("CREATE OR REPLACE FUNCTION public.calcular_demoras_embarque")) {
      return body;
    }
  }
  throw new Error("No se encontró migración con FUNCTION public.calcular_demoras_embarque");
}

describe("Fase H — demoras seguras", () => {
  const sql = readLatestDemorasMigration();

  it("adquiere pg_advisory_xact_lock por embarque", () => {
    expect(sql).toMatch(/pg_advisory_xact_lock\(hashtext\(p_embarque_id::text\)\)/);
  });

  it("levanta LC_DEMORAS_BLOQUEADAS con HINT jsonb", () => {
    expect(sql).toMatch(/LC_DEMORAS_BLOQUEADAS/);
    expect(sql).toMatch(/conceptos_venta_bloqueados/);
    expect(sql).toMatch(/conceptos_costo_bloqueados/);
  });

  it("filtra bloqueo por estado_facturacion en proforma/facturado", () => {
    expect(sql).toMatch(/estado_facturacion[^;]*IN[^)]*'en_proforma'[^)]*'facturado'/s);
  });

  it("valida bloqueo por CxP vía proveedor_facturas_conceptos", () => {
    expect(sql).toMatch(/proveedor_facturas_conceptos[\s\S]*concepto_costo_id\s*=\s*cc\.id/);
  });

  it("usa soft-delete en conceptos_costo y conceptos_venta (no DELETE crudo)", () => {
    // Debe existir UPDATE ... SET deleted_at = now() para ambas tablas
    expect(sql).toMatch(/UPDATE public\.conceptos_costo[\s\S]*SET deleted_at\s*=\s*now\(\)[\s\S]*origen\s*=\s*'demoras_auto'/);
    expect(sql).toMatch(/UPDATE public\.conceptos_venta[\s\S]*SET deleted_at\s*=\s*now\(\)[\s\S]*origen\s*=\s*'demoras_auto'/);
    // No debe haber DELETE FROM conceptos_(costo|venta) ... origen = 'demoras_auto' en el cuerpo
    const fnBody = sql
      .split("CREATE OR REPLACE FUNCTION public.calcular_demoras_embarque")[1]
      ?.split("$$;")[0] ?? "";
    expect(fnBody).not.toMatch(/DELETE\s+FROM\s+public\.conceptos_(costo|venta)/i);
  });

  it("lee moneda desde costeo_navieras_condiciones.moneda_demoras (no hardcode)", () => {
    expect(sql).toMatch(/moneda_demoras/);
    // El INSERT en conceptos_costo debe usar la variable, no la literal 'USD'::moneda
    expect(sql).toMatch(/COALESCE\(v_moneda_tier,'USD'\)::moneda/);
  });

  it("mantiene GRANT restrictivo (authenticated, service_role)", () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.calcular_demoras_embarque\(uuid\) FROM PUBLIC, anon/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.calcular_demoras_embarque\(uuid\) TO authenticated, service_role/);
  });
});
