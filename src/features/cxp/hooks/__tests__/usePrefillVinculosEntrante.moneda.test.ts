/**
 * Regresión ELIMP00329: un costo en USD pre-marcado desde el buzón contra una
 * factura en MXN debe entrar convertido con el T/C DOF. Antes se copiaba el
 * monto tal cual (51 tratado como pesos) y el ajuste de costo salía por casi la
 * factura completa (821.57 MXN fantasma).
 */
import { describe, it, expect } from "vitest";
import {
  dividirPorTipoCambio,
  requiereConversion,
} from "@/features/cxp/hooks/usePrefillVinculosEntrante";
import { convertirMonto } from "@/features/cxp/utils/vinculoMoneda";

const SUG_USD = {
  conceptoCostoId: "c1",
  concepto: "Cargos Destino",
  monto: 51,
  moneda: "USD",
};
const SUG_MXN = {
  conceptoCostoId: "c2",
  concepto: "Maniobras",
  monto: 400,
  moneda: "MXN",
};
const TC = { usdMxn: 17.0627, eurMxn: 19.6827 };

describe("requiereConversion", () => {
  it("detecta costo en otra moneda que la factura", () => {
    expect(requiereConversion([SUG_USD], "MXN")).toBe(true);
    expect(requiereConversion([SUG_MXN], "MXN")).toBe(false);
  });
});

describe("dividirPorTipoCambio", () => {
  it("con T/C convierte y no deja nada fuera", () => {
    const r = dividirPorTipoCambio([SUG_USD, SUG_MXN], "MXN", TC);
    expect(r.convertibles).toHaveLength(2);
    expect(r.sinTipoCambio).toHaveLength(0);
  });

  it("sin T/C excluye el costo en otra moneda en lugar de premarcarlo mal", () => {
    const r = dividirPorTipoCambio([SUG_USD, SUG_MXN], "MXN", null);
    expect(r.convertibles.map((s) => s.conceptoCostoId)).toEqual(["c2"]);
    expect(r.sinTipoCambio.map((s) => s.conceptoCostoId)).toEqual(["c1"]);
  });

  it("el importe convertido cierra contra la factura y no genera ajuste fantasma", () => {
    const base = convertirMonto(SUG_USD.monto, "USD", "MXN", TC) ?? 0;
    expect(base).toBeCloseTo(870.2, 1);
    // Factura real 872.57 MXN: el ajuste es la diferencia de T/C, no 821.57.
    expect(872.57 - base).toBeLessThan(5);
  });
});
