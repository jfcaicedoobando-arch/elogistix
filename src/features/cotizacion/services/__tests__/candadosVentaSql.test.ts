/**
 * v13.823.357 (Auditoría YAGNI P1 #1/#2/#3 y P2 #6/#7): regresión estática de
 * la fuente canónica. Si alguien quita un candado del SQL, este test falla.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const raiz = process.cwd();
const leer = (p: string) => readFileSync(join(raiz, p), "utf8");

const helper = leer("supabase/schema/cotizaciones/_assert_cotizacion_venta_valida.sql");
const core = leer("supabase/schema/embarques/crear_embarque_borrador_core.sql");
const convertible = leer("supabase/schema/cotizaciones/_assert_cotizacion_convertible.sql");
const replicar = leer("supabase/schema/embarques/_crear_embarque_replicar_conceptos.sql");

describe("candados de venta cotización → embarque (SQL canónico)", () => {
  it("el helper exige venta positiva, reflejo de costo y moneda soportada", () => {
    expect(helper).toContain("LC_COT_SIN_VENTA");
    expect(helper).toContain("LC_COT_VENTA_NO_REFLEJADA");
    expect(helper).toContain("LC_COT_MONEDA_NO_SOPORTADA");
    expect(helper).toContain("NOT IN ('MXN', 'USD')");
  });

  it("las cotizaciones informativas quedan exentas", () => {
    expect(helper).toContain("v_tipo_doc = 'informativa'");
  });

  it("el helper filtra costos vivos de la propia cotización", () => {
    expect(helper).toContain("cc.cotizacion_id = p_cotizacion_id");
    expect(helper).toContain("cc.deleted_at IS NULL");
  });

  it("core y el pre-check de la UI invocan el mismo helper", () => {
    expect(core).toContain("PERFORM public._assert_cotizacion_venta_valida(v_cot.id)");
    expect(convertible).toContain("PERFORM public._assert_cotizacion_venta_valida(p_cotizacion_id)");
  });

  it("la replicación es idempotente POR CONJUNTO (costos y ventas por separado)", () => {
    expect(replicar).toContain("IF v_tiene_costos AND v_tiene_ventas THEN");
    expect(replicar).toContain("IF NOT v_tiene_costos THEN");
    expect(replicar).toContain("IF NOT v_tiene_ventas AND jsonb_typeof(p_conceptos_venta) = 'array' THEN");
  });

  it("la replicación rechaza importes no positivos y moneda no soportada", () => {
    expect(replicar).toContain("LC_COT_VENTA_IMPORTE_INVALIDO");
    expect(replicar).toContain("LC_COT_MONEDA_NO_SOPORTADA");
    expect(replicar).toContain("IF v_cant <= 0 OR v_pu <= 0 THEN");
    // La cantidad 0 ya NO se reescribe a 1 en silencio.
    expect(replicar).not.toContain("COALESCE(NULLIF((v_venta->>'cantidad')::numeric, 0), 1)");
  });

  it("la replicación conserva el total del renglón de costo (cantidad x unitario)", () => {
    expect(replicar).toContain("COALESCE(v_costo.costo_total, v_costo.costo_unitario * v_costo.cantidad, 0)");
  });
});
