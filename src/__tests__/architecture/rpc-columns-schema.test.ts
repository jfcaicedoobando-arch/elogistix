/**
 * Regresión bloqueante para los 3 bugs de columnas inexistentes reparados en
 * 13.320.2 (audit RPC columns). Lee los schemas canónicos y verifica por regex
 * que no se reintroduzcan las referencias equivocadas.
 *
 * Si un mantenimiento futuro renombra columnas reales (`agente_id`, `code`,
 * `total`), este test salta antes de que el bug llegue a producción.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");

function read(rel: string): string {
  const full = path.join(ROOT, rel);
  expect(fs.existsSync(full), `Falta archivo ${rel}`).toBe(true);
  return fs.readFileSync(full, "utf-8");
}

describe("RPC columns · schema canónico coincide con columnas reales", () => {
  it("proveedor_salud usa embarques.agente_id (no agente_origen_id / agente_destino_id)", () => {
    const sql = read("supabase/schema/proveedores/proveedor_salud.sql");
    expect(sql).not.toMatch(/\bagente_origen_id\b/);
    expect(sql).not.toMatch(/\bagente_destino_id\b/);
    expect(sql).toMatch(/e\.agente_id\s*=\s*p_proveedor_id/);
    // El EXCEPTION WHEN undefined_column enmascaraba el bug; no debe volver.
    expect(sql).not.toMatch(/EXCEPTION\s+WHEN\s+undefined_column/i);
  });

  it("crear_embarque_borrador_core usa tipos_contenedor.code (no codigo)", () => {
    const sql = read("supabase/schema/embarques/crear_embarque_borrador_core.sql");
    expect(sql).not.toMatch(/\btc\.codigo\b/);
    expect(sql).not.toMatch(/tipos_contenedor\.codigo\b/);
    expect(sql).toMatch(/FROM\s+public\.tipos_contenedor[^;]*SELECT\s+code|SELECT\s+code\s+INTO\s+v_tipo_cont_code\s+FROM\s+public\.tipos_contenedor/is);
  });

  it("portal_obtener_proforma_por_token expone pcc.total como `importe` (no pcc.importe)", () => {
    const sql = read("supabase/schema/portal/portal_obtener_proforma_por_token.sql");
    // La clave del JSON conserva el nombre `importe` (contrato del front).
    expect(sql).toMatch(/'importe'\s*,\s*pcc\.total/);
    // Pero NO debe existir una referencia a la columna `pcc.importe`.
    expect(sql).not.toMatch(/\bpcc\.importe\b/);
  });
});
