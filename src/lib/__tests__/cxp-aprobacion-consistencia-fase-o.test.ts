/**
 * Guardrail Fase O (v13.301.86) — Validaciones de cuadre y consistencia al
 * aprobar facturas de proveedor (Bug 23).
 *
 * Blinda que la migración que instala `_cxp_validar_aprobacion` incluya:
 *  - Función SECURITY DEFINER con search_path fijo.
 *  - Validaciones: cuadre subtotal vs conceptos con tolerancia 0.01, embarque
 *    no cancelado, misma organización, y UUID SAT verificado.
 *  - REVOKE de PUBLIC/anon + GRANT restringido a authenticated y service_role.
 *  - `aprobar_factura_proveedor` invoca la validación sólo cuando `p_aprobar`.
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

describe("Fase O — Validación de aprobación CxP", () => {
  // Ojo: buscamos la migración que *define* la función, no la que sólo la
  // invoca (ej. wrappers posteriores de `aprobar_factura_proveedor`).
  const sql = readLatestContaining(
    "CREATE OR REPLACE FUNCTION public._cxp_validar_aprobacion",
  );

  it("declara la función `_cxp_validar_aprobacion(uuid)` como SECURITY DEFINER", () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\._cxp_validar_aprobacion\(p_factura_id uuid\)[\s\S]*?SECURITY DEFINER/,
    );
  });

  it("fija search_path a public", () => {
    expect(sql).toMatch(/SET search_path = public/);
  });

  it("valida cuadre subtotal vs conceptos con tolerancia 0.01", () => {
    expect(sql).toMatch(/LC_CXP_DESCUADRE/);
    expect(sql).toMatch(/> 0\.01/);
  });

  it("exige captura de conceptos antes de aprobar", () => {
    expect(sql).toMatch(/LC_CXP_SIN_CONCEPTOS/);
  });

  it("bloquea embarques cancelados y valida organización", () => {
    expect(sql).toMatch(/LC_CXP_EMBARQUE_CANCELADO/);
    expect(sql).toMatch(/LC_CXP_EMBARQUE_ORG_MISMATCH/);
  });

  it("exige uuid_verificado cuando hay uuid_fiscal", () => {
    expect(sql).toMatch(/LC_CXP_UUID_NO_VERIFICADO/);
    expect(sql).toMatch(/uuid_verificado/);
  });

  it("revoca EXECUTE de PUBLIC/anon y otorga a authenticated + service_role", () => {
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\._cxp_validar_aprobacion\(uuid\) FROM PUBLIC, anon/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\._cxp_validar_aprobacion\(uuid\) TO authenticated, service_role/,
    );
  });

  it("aprobar_factura_proveedor invoca la validación sólo cuando p_aprobar", () => {
    // Bloque IF p_aprobar THEN ... PERFORM public._cxp_validar_aprobacion(p_id).
    // El wrapper `aprobar_factura_proveedor` puede vivir en una migración distinta
    // a la que redefine la función de validación (ej. exención de extranjeros
    // v13.309.33 sólo toca `_cxp_validar_aprobacion`). Buscamos la migración más
    // reciente que contenga el wrapper.
    const wrapperSql = readLatestContaining("aprobar_factura_proveedor");
    expect(wrapperSql).toMatch(
      /IF p_aprobar THEN\s+PERFORM public\._cxp_validar_aprobacion\(p_id\)/,
    );
  });
});
