/**
 * N9 (v13.823.390) — El saldo cobrable manda desde el servidor
 * (`public.saldo_factura`), que ya convierte las notas de crédito a la moneda
 * de la factura. Antes el cliente sumaba `nc.monto` en crudo: una factura MXN
 * con NC en USD mostraba saldo de menos y proponía un cobro que la BD
 * rechazaba por sobrepago.
 */
import { describe, it, expect } from "vitest";
import { calcularSaldoFactura } from "../saldoFactura";

describe("calcularSaldoFactura · saldo del servidor (N9)", () => {
  it("factura MXN con NC en USD: usa el saldo convertido del servidor", () => {
    // Factura 10,000 MXN, sin pagos, NC de 100 USD aplicada a TC 20 = 2,000 MXN.
    // El servidor devuelve 8,000; la suma cruda daría 9,900.
    const r = calcularSaldoFactura(
      10000,
      [],
      [{ monto: 100 }],
      "Emitida",
      8000,
    );
    expect(r.saldo).toBe(8000);
    expect(r.notasCredito).toBe(2000);
  });

  it("descuenta los pagos vigentes del saldo servidor", () => {
    const r = calcularSaldoFactura(
      10000,
      [{ monto_aplicado_factura: 3000, estado_rep: "Timbrado" }],
      [{ monto: 100 }],
      "Emitida",
      5000,
    );
    expect(r.pagado).toBe(3000);
    expect(r.saldo).toBe(5000);
    expect(r.notasCredito).toBe(2000);
  });

  it("sin saldo servidor conserva la fórmula local (no rompe lecturas previas)", () => {
    const r = calcularSaldoFactura(
      10000,
      [{ monto_aplicado_factura: 1000, estado_rep: "Timbrado" }],
      [],
      "Emitida",
    );
    expect(r.saldo).toBe(9000);
  });
});
