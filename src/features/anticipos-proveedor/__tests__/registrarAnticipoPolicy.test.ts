import { describe, it, expect } from "vitest";
import {
  tcSugeridoParaMoneda,
  debeSugerirTc,
  cuentasDeMoneda,
  resolverCuentaBancaria,
  equivalenteMxnAnticipo,
  type TcSugeridoInput,
} from "@/features/anticipos-proveedor/domain/registrarAnticipoPolicy";

const tcOk: TcSugeridoInput = { usdMxn: 18.5, eurMxn: 20.1, esFallback: false, eurEsFallback: false };

describe("tcSugeridoParaMoneda", () => {
  it("no sugiere nada en MXN ni sin datos", () => {
    expect(tcSugeridoParaMoneda("MXN", tcOk)).toBeNull();
    expect(tcSugeridoParaMoneda("USD", null)).toBeNull();
  });

  it("sugiere el T/C de la moneda", () => {
    expect(tcSugeridoParaMoneda("USD", tcOk)).toBe(18.5);
    expect(tcSugeridoParaMoneda("EUR", tcOk)).toBe(20.1);
  });

  it("EF-04: nunca sugiere un fallback estimado", () => {
    expect(tcSugeridoParaMoneda("USD", { ...tcOk, esFallback: true })).toBeNull();
    expect(tcSugeridoParaMoneda("EUR", { ...tcOk, eurEsFallback: true })).toBeNull();
  });

  it("ignora valores no positivos", () => {
    expect(tcSugeridoParaMoneda("USD", { ...tcOk, usdMxn: 0 })).toBeNull();
    expect(tcSugeridoParaMoneda("EUR", { ...tcOk, eurMxn: null })).toBeNull();
  });
});

describe("debeSugerirTc", () => {
  it("respeta el valor capturado por el usuario", () => {
    expect(debeSugerirTc(17.2, 18.5)).toBe(false);
    expect(debeSugerirTc(undefined, 18.5)).toBe(true);
    expect(debeSugerirTc(0, 18.5)).toBe(true);
    expect(debeSugerirTc(undefined, null)).toBe(false);
  });
});

describe("cuentasDeMoneda / resolverCuentaBancaria", () => {
  const cuentas = [
    { id: "a", moneda: "MXN" },
    { id: "b", moneda: "USD" },
    { id: "c", moneda: "USD" },
  ];

  it("filtra por moneda", () => {
    expect(cuentasDeMoneda(cuentas, "USD").map((c) => c.id)).toEqual(["b", "c"]);
    expect(cuentasDeMoneda(cuentas, "EUR")).toEqual([]);
  });

  it("preselecciona la primera compatible", () => {
    expect(resolverCuentaBancaria(undefined, cuentasDeMoneda(cuentas, "USD"))).toBe("b");
  });

  it("limpia la cuenta cuando deja de coincidir", () => {
    expect(resolverCuentaBancaria("a", cuentasDeMoneda(cuentas, "USD"))).toBe("");
  });

  it("no cambia nada si la cuenta ya es válida o no hay opciones", () => {
    expect(resolverCuentaBancaria("b", cuentasDeMoneda(cuentas, "USD"))).toBeNull();
    expect(resolverCuentaBancaria(undefined, [])).toBeNull();
  });
});

describe("equivalenteMxnAnticipo", () => {
  it("devuelve el monto tal cual en MXN", () => {
    expect(equivalenteMxnAnticipo(1000, "MXN", undefined)).toBe(1000);
  });

  it("convierte con el T/C capturado", () => {
    expect(equivalenteMxnAnticipo(100, "USD", 18.5)).toBe(1850);
  });

  it("es null sin monto o sin T/C", () => {
    expect(equivalenteMxnAnticipo(0, "USD", 18.5)).toBeNull();
    expect(equivalenteMxnAnticipo(100, "USD", 0)).toBeNull();
  });
});
