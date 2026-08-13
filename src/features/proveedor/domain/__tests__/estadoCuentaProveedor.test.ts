import { describe, it, expect } from "vitest";
import {
  calcularBrechaFacturacion,
  toneEstadoConciliacion,
  type PartidaEstadoCuenta,
} from "../estadoCuentaProveedor";

function partida(over: Partial<PartidaEstadoCuenta>): PartidaEstadoCuenta {
  return {
    concepto_costo_id: "cc-1",
    embarque_id: "emb-1",
    expediente: "ELIMP00300",
    cliente_nombre: "Cliente",
    concepto: "Flete",
    comprometido: 1000,
    moneda: "MXN",
    estado_liquidacion: "Pendiente",
    fecha_vencimiento: null,
    created_at: "2026-01-01",
    facturado: 0,
    pagado: 0,
    por_facturar: 1000,
    facturas: [],
    estado_conciliacion: "Por facturar",
    ...over,
  };
}

describe("calcularBrechaFacturacion", () => {
  it("agrupa el pendiente por moneda nativa sin mezclar divisas", () => {
    const brecha = calcularBrechaFacturacion([
      partida({ moneda: "MXN", por_facturar: 1000 }),
      partida({ concepto_costo_id: "cc-2", moneda: "USD", por_facturar: 250 }),
      partida({ concepto_costo_id: "cc-3", moneda: "usd", por_facturar: 50 }),
    ]);
    expect(brecha.porFacturarPorMoneda).toEqual({ MXN: 1000, USD: 300 });
    expect(brecha.partidasPendientes).toBe(3);
    expect(brecha.totalPartidas).toBe(3);
  });

  it("ignora partidas ya respaldadas y cuenta sobrefacturadas", () => {
    const brecha = calcularBrechaFacturacion([
      partida({ facturado: 1000, por_facturar: 0, estado_conciliacion: "Facturado" }),
      partida({
        concepto_costo_id: "cc-2",
        facturado: 1500,
        por_facturar: 0,
        estado_conciliacion: "Sobrefacturado",
      }),
    ]);
    expect(brecha.partidasPendientes).toBe(0);
    expect(brecha.porFacturarPorMoneda).toEqual({});
    expect(brecha.partidasSobrefacturadas).toBe(1);
  });
});

describe("toneEstadoConciliacion", () => {
  it("usa tokens semánticos, nunca colores crudos", () => {
    for (const estado of ["Pagado", "Facturado", "Facturado parcial", "Sobrefacturado", "Por facturar"] as const) {
      const cls = toneEstadoConciliacion(estado);
      expect(cls).not.toMatch(/#|text-white|bg-black/);
      expect(cls.length).toBeGreaterThan(0);
    }
  });
});
