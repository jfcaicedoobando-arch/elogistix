import { describe, it, expect } from "vitest";
import { repartirFifo, validarLote, round2 } from "../pagoProveedorLote";

const F = [
  { factura_id: "b", folio_proveedor: "B", fecha_vencimiento: "2026-09-10", saldo: 500 },
  { factura_id: "a", folio_proveedor: "A", fecha_vencimiento: "2026-08-01", saldo: 300 },
];

describe("repartirFifo", () => {
  it("liquida primero la factura que vence antes", () => {
    const { renglones, sobrante } = repartirFifo(F, 400);
    expect(renglones[0]).toEqual({ factura_id: "a", monto: 300 });
    expect(renglones[1]).toEqual({ factura_id: "b", monto: 100 });
    expect(sobrante).toBe(0);
  });

  it("no asigna más que el saldo y devuelve el sobrante", () => {
    const { renglones, sobrante } = repartirFifo(F, 1000);
    expect(renglones.map((r) => r.monto)).toEqual([300, 500]);
    expect(sobrante).toBe(200);
  });

  it("redondea a 2 decimales", () => {
    expect(round2(100.005)).toBe(100.01);
  });
});

describe("validarLote", () => {
  const opts = { requiereCuenta: true, cuentaId: "c1", monedaCuenta: "USD", moneda: "USD" };

  it("acepta un reparto válido", () => {
    const { renglones } = repartirFifo(F, 400);
    expect(validarLote(F, renglones, 400, opts).error).toBeNull();
  });

  it("rechaza si el importe sólo alcanza una factura", () => {
    const { renglones } = repartirFifo(F, 100);
    expect(validarLote(F, renglones, 100, opts).error).toMatch(/al menos dos facturas/);
  });

  it("rechaza cuenta en otra moneda", () => {
    const { renglones } = repartirFifo(F, 400);
    const res = validarLote(F, renglones, 400, { ...opts, monedaCuenta: "MXN" });
    expect(res.error).toMatch(/MXN/);
  });

  it("rechaza asignar más que el saldo de una factura", () => {
    const res = validarLote(
      F,
      [{ factura_id: "a", monto: 900 }, { factura_id: "b", monto: 100 }],
      1000,
      opts,
    );
    expect(res.error).toMatch(/excede su saldo/);
  });

  it("exige cuenta bancaria cuando el método la requiere", () => {
    const { renglones } = repartirFifo(F, 400);
    const res = validarLote(F, renglones, 400, { ...opts, cuentaId: null });
    expect(res.error).toMatch(/cuenta bancaria/);
  });
});
