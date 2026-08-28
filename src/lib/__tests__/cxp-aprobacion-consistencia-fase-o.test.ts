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
      /CREATE OR REPLACE FUNCTION public\._cxp_validar_aprobacion\(\s*p_factura_id uuid(,\s*p_justificacion text DEFAULT NULL::text)?\s*\)[\s\S]*?SECURITY DEFINER/,
    );
  });

  it("fija search_path a public", () => {
    expect(sql).toMatch(/SET search_path (=|TO) '?public'?/);
  });

  it("valida cuadre subtotal vs conceptos con tolerancia por cantidad", () => {
    expect(sql).toMatch(/LC_CXP_DESCUADRE/);
    // v13.617.0: tolerancia = max(0.01, 0.005 × unidades) para absorber el
    // redondeo del precio unitario del CFDI en cantidades altas.
    expect(sql).toMatch(/GREATEST\(0\.01, 0\.005/);
    expect(sql).toMatch(/> v_tolerancia/);
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

  // Auditoría 2026-08-28 · Hallazgo 2: `_cxp_validar_aprobacion` es un helper
  // interno; sólo lo invoca `aprobar_factura_proveedor` (SECURITY DEFINER, corre
  // como dueño). Por eso `authenticated` ya NO tiene EXECUTE.
  it("revoca EXECUTE de PUBLIC/anon/authenticated y otorga sólo a service_role", () => {
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\._cxp_validar_aprobacion\(uuid(, text)?\) FROM PUBLIC/,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\._cxp_validar_aprobacion\(uuid(, text)?\) FROM (PUBLIC, )?anon/,
    );

    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\._cxp_validar_aprobacion\(uuid(, text)?\) FROM authenticated/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\._cxp_validar_aprobacion\(uuid(, text)?\) TO service_role/,
    );
  });

  it("aprobar_factura_proveedor invoca la validación sólo cuando p_aprobar", () => {
    // Bloque IF p_aprobar THEN ... PERFORM public._cxp_validar_aprobacion(p_id).
    // El wrapper `aprobar_factura_proveedor` puede vivir en una migración distinta
    // a la que redefine la función de validación (ej. exención de extranjeros
    // v13.309.33 sólo toca `_cxp_validar_aprobacion`). Buscamos la migración más
    // reciente que contenga el wrapper.
    const wrapperSql = readLatestContaining(
      "CREATE OR REPLACE FUNCTION public.aprobar_factura_proveedor",
    );
    expect(wrapperSql).toMatch(
      /IF p_aprobar THEN\s+PERFORM public\._cxp_validar_aprobacion\(p_id(, p_motivo)?\)/,
    );
  });
});
