import { describe, expect, it } from "vitest";
import {
  agingPorMoneda,
  conSaldoCorrido,
  filtrarPorRango,
  type AgingFilaProveedor,
  type MovimientoProveedor,
} from "@/features/proveedor/domain/movimientosProveedor";

const mov = (over: Partial<MovimientoProveedor>): MovimientoProveedor => ({
  fecha: "2026-01-10",
  tipo: "Factura",
  ref_id: "f1",
  folio: "FP-000001",
  referencia: null,
  expediente: "ELIMP00001",
  embarque_id: null,
  moneda: "MXN",
  cargo: 0,
  abono: 0,
  detalle: null,
  ...over,
});

describe("conSaldoCorrido", () => {
  it("acumula cargos y abonos por moneda sin mezclar divisas", () => {
    const res = conSaldoCorrido([
      mov({ ref_id: "a", cargo: 1000 }),
      mov({ ref_id: "b", moneda: "USD", cargo: 500 }),
      mov({ ref_id: "c", tipo: "Pago", abono: 400 }),
      mov({ ref_id: "d", moneda: "USD", tipo: "Pago", abono: 100 }),
    ]);
    expect(res.map((r) => r.saldo)).toEqual([1000, 500, 600, 400]);
  });

  it("normaliza la moneda a mayúsculas y trata valores faltantes como cero", () => {
    const res = conSaldoCorrido([
      mov({ moneda: "mxn", cargo: 100 }),
      mov({ moneda: "MXN", cargo: Number.NaN }),
    ]);
    expect(res[1].saldo).toBe(100);
  });

  it("devuelve arreglo vacío sin movimientos", () => {
    expect(conSaldoCorrido([])).toEqual([]);
  });
});

describe("agingPorMoneda", () => {
  const filas: AgingFilaProveedor[] = [
    { moneda: "MXN", bucket: "Vigente", saldo: 1000, conteo: 1 },
    { moneda: "MXN", bucket: "31-60", saldo: 500, conteo: 2 },
    { moneda: "USD", bucket: "90+", saldo: 250, conteo: 1 },
  ];

  it("agrupa por moneda con totales y vencido", () => {
    const res = agingPorMoneda(filas);
    expect(res).toHaveLength(2);
    const mxn = res.find((r) => r.moneda === "MXN")!;
    expect(mxn.total).toBe(1500);
    expect(mxn.vencido).toBe(500);
    expect(mxn.conteo).toBe(3);
    expect(mxn.buckets["61-90"]).toBe(0);
  });

  it("ordena alfabéticamente por moneda", () => {
    expect(agingPorMoneda(filas).map((r) => r.moneda)).toEqual(["MXN", "USD"]);
  });
});

describe("filtrarPorRango", () => {
  it("incluye los extremos del rango", () => {
    const movs = [
      mov({ fecha: "2026-01-01" }),
      mov({ fecha: "2026-02-15" }),
      mov({ fecha: "2026-03-01" }),
    ];
    const res = filtrarPorRango(movs, "2026-01-01", "2026-02-15");
    expect(res.map((m) => m.fecha)).toEqual(["2026-01-01", "2026-02-15"]);
  });

  it("descarta movimientos sin fecha", () => {
    expect(filtrarPorRango([mov({ fecha: "" })], "2026-01-01", "2026-12-31")).toHaveLength(0);
  });
});
