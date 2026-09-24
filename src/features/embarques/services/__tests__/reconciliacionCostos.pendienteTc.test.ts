/**
 * P1-1 — vínculos sin tipo de cambio no se presentan como ahorro ni como
 * "Sin factura" y no contaminan el ajuste neto del proveedor.
 * Datos ficticios: forwarder de Monterrey, flete USD con facturas MXN.
 */
import { describe, expect, it } from "vitest";
import { buildFilasReconciliacion } from "@/features/embarques/services/reconciliacionCostos.filas";
import type { CCRow, PFCRow } from "@/features/embarques/services/reconciliacionCostos.tipos";
import { calcularSubtotales } from "@/features/embarques/components/costos/grupoCostosProveedorHelpers";
import { describirAjuste, describirAjusteNeto } from "@/features/embarques/components/costos/ajusteDescripcion";

const flete: CCRow = {
  id: "cc-flete", concepto: "Flete marítimo Shanghái–Manzanillo", proveedor_nombre: "Transportes Regios del Norte",
  moneda: "USD", monto: 1200, estado_liquidacion: "Pendiente",
};
const maniobras: CCRow = { ...flete, id: "cc-man", concepto: "Maniobras", monto: 300 };

function vinc(id: string, cc: string, monto: number, fx: { moneda: string; tc: number | null; estado?: string }): PFCRow {
  const { moneda, tc, estado = "Vigente" } = fx;
  return {
    monto, concepto_costo_id: cc, descripcion: null,
    proveedor_facturas: {
      id, folio_interno: `FP-0000${id.slice(-1)}`, folio_proveedor: `MTY-${id}`,
      estado, moneda, tipo_cambio_usd: tc, deleted_at: null,
    },
  };
}

describe("P1-1 pendiente de tipo de cambio", () => {
  it("factura MXN ligada a costo USD sin TC: no_comparable, folio visible, sin ahorro", () => {
    const [f] = buildFilasReconciliacion([flete], [vinc("pf1", "cc-flete", 21000, { moneda: "MXN", tc: null })]);
    expect(f.estatus_renglon).toBe("no_comparable");
    expect(f.facturas[0].folio_interno).toBe("FP-00001");
    expect(f.facturas[0].monto_original).toBe(21000);
    const aj = describirAjuste(f.cotizado, f.real_facturado, f.moneda, {
      tieneFactura: true, pendienteTc: (f.vinculos_excluidos ?? 0) > 0,
    });
    expect(aj.kind).toBe("no_comparable");
    expect(aj.titulo).toBe("Pendiente de tipo de cambio");
    const [s] = calcularSubtotales([f]);
    expect(s).toMatchObject({ cotizadoFacturable: 0, facturadoFacturable: 0, noComparables: 1, sinFactura: 0 });
    expect(describirAjusteNeto(s.cotizadoFacturable, s.facturadoFacturable, "USD").kind).toBe("sin_factura");
  });

  it("1 comparable + 1 excluida en el mismo renglón: sigue no_comparable", () => {
    const [f] = buildFilasReconciliacion([flete], [
      vinc("pf1", "cc-flete", 500, { moneda: "USD", tc: null }),
      vinc("pf2", "cc-flete", 9000, { moneda: "MXN", tc: null }),
    ]);
    expect(f.estatus_renglon).toBe("no_comparable");
    expect(f.real_facturado).toBe(500);
    expect(calcularSubtotales([f])[0].facturadoFacturable).toBe(0);
  });

  it("con TC válido se compara normal y entra al ajuste neto", () => {
    const filas = buildFilasReconciliacion([flete, maniobras], [
      vinc("pf1", "cc-flete", 21000, { moneda: "MXN", tc: 17.5 }),
      vinc("pf2", "cc-man", 5000, { moneda: "MXN", tc: null }),
    ]);
    expect(filas[0].estatus_renglon).toBe("conciliado");
    const [s] = calcularSubtotales(filas);
    expect(s.cotizadoFacturable).toBe(1200);
    expect(s.facturadoFacturable).toBeCloseTo(1200, 2);
    expect(s.noComparables).toBe(1);
    expect(describirAjusteNeto(s.cotizadoFacturable, s.facturadoFacturable, "USD").kind).toBe("sin_ajuste");
  });

  it("factura cancelada no acredita: sin_match", () => {
    const [f] = buildFilasReconciliacion([flete], [vinc("pf1", "cc-flete", 21000, { moneda: "MXN", tc: null, estado: "Cancelada" })]);
    expect(f.estatus_renglon).toBe("sin_match");
    expect(f.facturas).toHaveLength(0);
  });
});
