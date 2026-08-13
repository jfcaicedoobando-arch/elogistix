/**
 * Pruebas del cobro en lote de cliente (pago múltiple CxC):
 * reparto FIFO por vencimiento y validaciones de negocio.
 */
import { describe, it, expect } from "vitest";
import { todayLocalISO } from "@/lib/date/today";
import {
  repartirFifo,
  validarCobroLote,
  type FacturaCobroCandidata,
} from "../pagoClienteLote";

const facturas: FacturaCobroCandidata[] = [
  { factura_id: "f-nueva", numero: "A-2", fecha_vencimiento: "2026-03-20", saldo: 500 },
  { factura_id: "f-vieja", numero: "A-1", fecha_vencimiento: "2026-01-10", saldo: 1000 },
];

describe("repartirFifo", () => {
  it("aplica primero la factura que vence antes", () => {
    const { renglones, sobrante } = repartirFifo(facturas, 1200);
    expect(renglones).toEqual([
      { factura_id: "f-vieja", monto: 1000 },
      { factura_id: "f-nueva", monto: 200 },
    ]);
    expect(sobrante).toBe(0);
  });

  it("no asigna más que el saldo y reporta el sobrante", () => {
    const { renglones, sobrante } = repartirFifo(facturas, 2000);
    expect(renglones.map((r) => r.monto)).toEqual([1000, 500]);
    expect(sobrante).toBe(500);
  });

  it("deja en cero las facturas que el importe no alcanza", () => {
    const { renglones } = repartirFifo(facturas, 400);
    expect(renglones).toEqual([
      { factura_id: "f-vieja", monto: 400 },
      { factura_id: "f-nueva", monto: 0 },
    ]);
  });

  it("trata las facturas sin vencimiento como las últimas", () => {
    const sinFecha: FacturaCobroCandidata[] = [
      { factura_id: "sin", numero: null, fecha_vencimiento: null, saldo: 100 },
      ...facturas,
    ];
    const { renglones } = repartirFifo(sinFecha, 1600);
    expect(renglones[renglones.length - 1].factura_id).toBe("sin");
  });
});

describe("validarCobroLote", () => {
  const hoy = todayLocalISO();
  const opts = {
    cuentaId: "c1",
    monedaCuenta: "MXN",
    moneda: "MXN",
    fecha: hoy,
    tcAplicable: null,
  };

  it("acepta un reparto válido", () => {
    const { renglones } = repartirFifo(facturas, 1200);
    expect(validarCobroLote(facturas, renglones, 1200, opts)).toEqual({
      error: null,
      totalRepartido: 1200,
    });
  });

  it("exige al menos dos facturas", () => {
    const una = [facturas[0]];
    const res = validarCobroLote(una, [{ factura_id: "f-nueva", monto: 100 }], 100, opts);
    expect(res.error).toMatch(/al menos dos facturas/i);
  });

  it("exige importe mayor a cero", () => {
    const res = validarCobroLote(facturas, [], 0, opts);
    expect(res.error).toMatch(/importe total/i);
  });

  it("rechaza importe que sólo alcanza una factura", () => {
    const { renglones } = repartirFifo(facturas, 300);
    const res = validarCobroLote(facturas, renglones, 300, opts);
    expect(res.error).toMatch(/al menos dos facturas/i);
  });

  it("rechaza un renglón que excede el saldo de su factura", () => {
    const renglones = [
      { factura_id: "f-vieja", monto: 1500 },
      { factura_id: "f-nueva", monto: 100 },
    ];
    const res = validarCobroLote(facturas, renglones, 1600, opts);
    expect(res.error).toMatch(/excede su saldo/i);
  });

  it("rechaza reparto mayor al importe recibido", () => {
    const renglones = [
      { factura_id: "f-vieja", monto: 1000 },
      { factura_id: "f-nueva", monto: 500 },
    ];
    const res = validarCobroLote(facturas, renglones, 1000, opts);
    expect(res.error).toMatch(/no puede exceder/i);
  });

  it("rechaza sobrante sin asignar (Ola 5 · RG4-5)", () => {
    const { renglones } = repartirFifo(facturas, 1200);
    const res = validarCobroLote(facturas, renglones, 1500, opts);
    expect(res.error).toMatch(/exactamente el importe recibido/i);
  });

  it("rechaza dos renglones a la misma factura (Ola 6 · RG4-6)", () => {
    const res = validarCobroLote(
      facturas,
      [
        { factura_id: "f-vieja", monto: 600 },
        { factura_id: "f-vieja", monto: 400 },
      ],
      1000,
      opts,
    );
    expect(res.error).toMatch(/más de una vez/i);
  });

  it("rechaza cuenta bancaria en otra moneda", () => {
    const { renglones } = repartirFifo(facturas, 1200);
    const res = validarCobroLote(facturas, renglones, 1200, {
      cuentaId: "c1",
      monedaCuenta: "USD",
      moneda: "MXN",
    });
    expect(res.error).toMatch(/misma moneda/i);
  });

});
