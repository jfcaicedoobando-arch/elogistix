import { describe, expect, it } from "vitest";
import {
  asignarSaldoFactura,
  asignarSobrante,
  ordenFifo,
} from "@/features/facturacion/services/cobroLoteAtajos";
import {
  erroresPorRenglon,
  repartirCero,
  repartirTodo,
} from "@/features/facturacion/services/pagoClienteLote";
import type { FacturaCobroCandidata } from "@/features/facturacion/services/pagoClienteLote";

const facturas: FacturaCobroCandidata[] = [
  { factura_id: "b", numero: "F-2", fecha_vencimiento: "2026-02-01", saldo: 500 },
  { factura_id: "a", numero: "F-1", fecha_vencimiento: "2026-01-01", saldo: 1000 },
];

describe("cobroLoteAtajos", () => {
  it("ordena FIFO por vencimiento", () => {
    expect(ordenFifo(facturas).map((f) => f.factura_id)).toEqual(["a", "b"]);
  });

  it("repartirTodo asigna el saldo completo de cada factura", () => {
    expect(repartirTodo(facturas)).toEqual([
      { factura_id: "b", monto: 500 },
      { factura_id: "a", monto: 1000 },
    ]);
  });

  it("repartirCero deja todo en cero", () => {
    expect(repartirCero(facturas).every((r) => r.monto === 0)).toBe(true);
  });

  it("asignarSaldoFactura no rebasa lo que queda sin asignar", () => {
    const renglones = [
      { factura_id: "b", monto: 0 },
      { factura_id: "a", monto: 0 },
    ];
    const res = asignarSaldoFactura(facturas, renglones, "a", 300);
    expect(res.find((r) => r.factura_id === "a")?.monto).toBe(300);
  });

  it("asignarSaldoFactura llega al saldo cuando hay suficiente", () => {
    const renglones = [{ factura_id: "a", monto: 200 }];
    const res = asignarSaldoFactura(facturas, renglones, "a", 5000);
    expect(res[0].monto).toBe(1000);
  });

  it("asignarSobrante reparte en orden FIFO respetando el saldo", () => {
    const renglones = [
      { factura_id: "b", monto: 0 },
      { factura_id: "a", monto: 0 },
    ];
    const res = asignarSobrante(facturas, renglones, 1200);
    expect(res.find((r) => r.factura_id === "a")?.monto).toBe(1000);
    expect(res.find((r) => r.factura_id === "b")?.monto).toBe(200);
  });

  it("asignarSobrante no hace nada sin sobrante", () => {
    const renglones = [{ factura_id: "a", monto: 100 }];
    expect(asignarSobrante(facturas, renglones, 0)).toEqual(renglones);
  });

  it("erroresPorRenglon marca sólo el renglón que excede su saldo", () => {
    const errores = erroresPorRenglon(facturas, [
      { factura_id: "a", monto: 1500 },
      { factura_id: "b", monto: 400 },
    ]);
    expect(Object.keys(errores)).toEqual(["a"]);
  });
});
