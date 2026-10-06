import { describe, it, expect } from "vitest";
import { validarCobroLote, erroresPorRenglon, type FacturaCobroCandidata } from "../pagoClienteLote";
import { todayLocalISO } from "@/lib/date/today";

const facturas: FacturaCobroCandidata[] = [
  { factura_id: "pue", numero: "A3", saldo: 58, metodo_pago: "PUE", fecha_vencimiento: null },
  { factura_id: "ppd", numero: "A4", saldo: 58, metodo_pago: "PPD", fecha_vencimiento: null },
];
const opts = { cuentaId: null, monedaCuenta: null, moneda: "MXN", fecha: todayLocalISO(), tcAplicable: null, formaPago: "03" };
describe("AUD116: PUE en lote", () => {
  it("rechaza reparto parcial PUE y marca su fila", () => {
    const lineas = [{ factura_id: "pue", monto: 10 }, { factura_id: "ppd", monto: 10 }];
    expect(validarCobroLote(facturas, lineas, 20, opts).error).toContain("A3 es PUE");
    expect(erroresPorRenglon(facturas, lineas)).toEqual({ pue: expect.stringContaining("liquidar el saldo total") });
  });
  it.each([58, 57.99])("acepta cierre PUE neto de NC por %s con tolerancia canónica", (monto) => {
    const lineas = [{ factura_id: "pue", monto }, { factura_id: "ppd", monto: 10 }];
    expect(validarCobroLote(facturas, lineas, monto + 10, opts).error).toBeNull();
    expect(erroresPorRenglon(facturas, lineas)).toEqual({});
  });
  it("no exige liquidar PPD y no acepta residual PUE de dos centavos", () => {
    expect(validarCobroLote(facturas, [{ factura_id: "pue", monto: 57.98 }, { factura_id: "ppd", monto: 1 }], 58.98, opts).error).toMatch(/PUE/);
    expect(validarCobroLote(facturas.map((f) => ({ ...f, metodo_pago: "PPD" })), [{ factura_id: "pue", monto: 10 }, { factura_id: "ppd", monto: 10 }], 20, opts).error).toBeNull();
  });
});
