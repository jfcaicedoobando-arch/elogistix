import { describe, expect, it } from "vitest";
import {
  convertirMonto,
  desviacionTcExcedida,
  factorConversion,
  tcImplicito,
} from "../vinculoMoneda";

const TC = { usdMxn: 17.1092, eurMxn: 18.5 };

describe("factorConversion", () => {
  it("devuelve 1 cuando la moneda es la misma", () => {
    expect(factorConversion("USD", "USD", null)).toBe(1);
    expect(factorConversion("MXN", "MXN", null)).toBe(1);
  });

  it("USD → MXN usa el T/C DOF", () => {
    expect(factorConversion("USD", "MXN", TC)).toBeCloseTo(17.1092, 6);
  });

  it("MXN → USD invierte el T/C", () => {
    expect(factorConversion("MXN", "USD", TC)).toBeCloseTo(1 / 17.1092, 8);
  });

  it("USD → EUR cruza por el pivote MXN", () => {
    expect(factorConversion("USD", "EUR", TC)).toBeCloseTo(17.1092 / 18.5, 8);
  });

  it("devuelve null sin T/C disponible", () => {
    expect(factorConversion("USD", "MXN", null)).toBeNull();
    expect(factorConversion("EUR", "MXN", { usdMxn: 17.1092, eurMxn: null })).toBeNull();
    expect(factorConversion("USD", "MXN", { usdMxn: 0, eurMxn: null })).toBeNull();
  });

  it("devuelve null para monedas no soportadas", () => {
    expect(factorConversion("JPY", "MXN", TC)).toBeNull();
  });
});

describe("convertirMonto", () => {
  it("convierte 51 USD al equivalente en MXN redondeado a centavos", () => {
    expect(convertirMonto(51, "USD", "MXN", TC)).toBe(872.57);
  });

  it("no toca el monto cuando la moneda coincide", () => {
    expect(convertirMonto(872.57, "MXN", "MXN", TC)).toBe(872.57);
  });

  it("devuelve null sin T/C", () => {
    expect(convertirMonto(51, "USD", "MXN", null)).toBeNull();
  });
});

describe("tcImplicito", () => {
  it("calcula el T/C que resulta de lo capturado", () => {
    expect(tcImplicito(872.57, 51)).toBeCloseTo(17.1092, 3);
  });

  it("devuelve null con montos no positivos", () => {
    expect(tcImplicito(872.57, 0)).toBeNull();
    expect(tcImplicito(0, 51)).toBeNull();
  });
});

describe("desviacionTcExcedida", () => {
  it("no marca desviación dentro del 2%", () => {
    expect(desviacionTcExcedida(17.3, 17.1092)).toBe(false);
  });

  it("marca desviación por arriba del 2%", () => {
    expect(desviacionTcExcedida(19.5, 17.1092)).toBe(true);
  });

  it("es tolerante con datos faltantes", () => {
    expect(desviacionTcExcedida(null, 17.1092)).toBe(false);
    expect(desviacionTcExcedida(17.1, null)).toBe(false);
  });
});
