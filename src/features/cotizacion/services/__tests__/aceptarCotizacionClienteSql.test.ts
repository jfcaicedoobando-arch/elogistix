/**
 * v13.823.359 (Addendum P1): regresión estática de `aceptar_cotizacion_version`.
 * Aceptar exige cliente asignado (y oportunidad ligada en prospectos) TAMBIÉN en
 * el camino idempotente, para no devolver éxito sobre cotizaciones legadas que
 * después no pueden convertirse en embarque.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/schema/cotizaciones/aceptar_cotizacion_version.sql"),
  "utf8",
);
const cuerpo = sql.slice(sql.indexOf("AS $$"));

describe("aceptar_cotizacion_version (SQL canónico)", () => {
  it("exige cliente y, en prospectos, oportunidad ligada", () => {
    expect(cuerpo).toContain("LC_COT_SIN_CLIENTE");
    expect(cuerpo).toContain("LC_COT_SIN_OPORTUNIDAD");
    expect(cuerpo).toContain("IF v_cliente_id IS NULL THEN");
    expect(cuerpo).toContain("COALESCE(v_es_prospecto, false) AND v_oportunidad_id IS NULL");
  });

  it("evalúa los candados antes del camino idempotente y del sello", () => {
    const cliente = cuerpo.indexOf("LC_COT_SIN_CLIENTE");
    const oportunidad = cuerpo.indexOf("LC_COT_SIN_OPORTUNIDAD");
    const idempotente = cuerpo.indexOf("IF v_estado_actual IN ('Aceptada','En operación') THEN");
    const sello = cuerpo.indexOf("UPDATE cotizaciones");
    const autoridad = cuerpo.indexOf("LC_NO_AUTORIZADO");
    expect(idempotente).toBeGreaterThan(0);
    expect(cliente).toBeLessThan(idempotente);
    expect(oportunidad).toBeLessThan(idempotente);
    expect(cliente).toBeLessThan(sello);
    expect(autoridad).toBeLessThan(cliente);
  });

  it("mantiene exentas las informativas y el resto del contrato", () => {
    expect(cuerpo).toContain("COALESCE(v_tipo_documento, 'transaccional') <> 'informativa'");
    expect(cuerpo).toContain("LC_SOD_VIOLATION");
    expect(cuerpo).toContain("LC_COT_IMPORTE_REQUERIDO");
    expect(sql).toContain("FROM PUBLIC;");
    expect(sql).toContain("TO authenticated, service_role;");
  });
});
