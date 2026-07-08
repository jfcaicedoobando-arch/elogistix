import { describe, it, expect } from "vitest";
import { aplicarFiltros, estatusDeFila } from "../useCxpPorCapturarFilters";
import type { CxpPorCapturarRow } from "@/features/bandejas/services/bandejas";

const row = (over: Partial<CxpPorCapturarRow>): CxpPorCapturarRow => ({
  embarque_id: "e1",
  expediente: "EXP-001",
  cliente_nombre: "Acme",
  presupuestado_mxn: 1000,
  presupuestado_usd: 0,
  facturado_mxn: 0,
  facturado_usd: 0,
  facturas_capturadas: 0,
  ultima_factura_fecha: null,
  dias_desde_ultima_factura: null,
  ...over,
});

describe("useCxpPorCapturarFilters helpers", () => {
  it("estatusDeFila distingue sin/parcial/completo", () => {
    expect(estatusDeFila(row({}))).toBe("sin");
    expect(estatusDeFila(row({ facturas_capturadas: 1, facturado_mxn: 400 }))).toBe("parcial");
    expect(estatusDeFila(row({ facturas_capturadas: 2, facturado_mxn: 1000 }))).toBe("completo");
    expect(estatusDeFila(row({ facturas_capturadas: 2, facturado_mxn: 1200 }))).toBe("completo");
  });

  it("estatusDeFila evalúa MXN y USD por separado", () => {
    // Presupuesto mixto: MXN cubierto pero USD no → parcial
    expect(
      estatusDeFila(
        row({
          facturas_capturadas: 1,
          presupuestado_mxn: 500,
          presupuestado_usd: 200,
          facturado_mxn: 500,
          facturado_usd: 0,
        }),
      ),
    ).toBe("parcial");
    // Ambas monedas cubiertas → completo
    expect(
      estatusDeFila(
        row({
          facturas_capturadas: 2,
          presupuestado_mxn: 500,
          presupuestado_usd: 200,
          facturado_mxn: 500,
          facturado_usd: 200,
        }),
      ),
    ).toBe("completo");
  });

  it("filtra por query en expediente y cliente", () => {
    const rows = [row({ expediente: "EXP-001" }), row({ expediente: "EXP-002", cliente_nombre: "Beta" })];
    expect(aplicarFiltros(rows, {
      query: "beta", estatus: "todos", antiguedad: "todos", ordenarPor: "expediente", direccion: "asc",
    })).toHaveLength(1);
  });

  it("filtra por antigüedad >30 días", () => {
    const rows = [
      row({ embarque_id: "a", dias_desde_ultima_factura: 5, facturas_capturadas: 1 }),
      row({ embarque_id: "b", dias_desde_ultima_factura: 45, facturas_capturadas: 1 }),
      row({ embarque_id: "c", dias_desde_ultima_factura: null }),
    ];
    const r = aplicarFiltros(rows, {
      query: "", estatus: "todos", antiguedad: "gt30", ordenarPor: "antiguedad", direccion: "desc",
    });
    expect(r.map((x) => x.embarque_id)).toEqual(["b"]);
  });

  it("ordena por monto descendente (suma ambas monedas como proxy)", () => {
    const rows = [
      row({ embarque_id: "a", presupuestado_mxn: 100 }),
      row({ embarque_id: "b", presupuestado_mxn: 900 }),
      row({ embarque_id: "c", presupuestado_mxn: 500 }),
    ];
    const r = aplicarFiltros(rows, {
      query: "", estatus: "todos", antiguedad: "todos", ordenarPor: "monto", direccion: "desc",
    });
    expect(r.map((x) => x.embarque_id)).toEqual(["b", "c", "a"]);
  });
});
