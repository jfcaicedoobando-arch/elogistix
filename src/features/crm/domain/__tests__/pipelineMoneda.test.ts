import { describe, it, expect } from "vitest";
import { sumarPipelineMxn } from "@/features/crm/domain/pipelineMoneda";

const TC = { usdMxn: 18, eurMxn: 20 };

describe("sumarPipelineMxn (UI-15)", () => {
  it("convierte USD y EUR a pesos antes de sumar", () => {
    const r = sumarPipelineMxn(
      [
        { monto: 1000, moneda: "MXN" },
        { monto: 100, moneda: "USD" },
        { monto: 50, moneda: "EUR" },
      ],
      TC,
    );
    expect(r.mxn).toBe(1000 + 1800 + 1000);
    expect(r.estimado).toBe(false);
  });

  it("trata moneda nula como MXN y ignora montos vacíos", () => {
    const r = sumarPipelineMxn([{ monto: 500, moneda: null }, { monto: null, moneda: "USD" }], TC);
    expect(r.mxn).toBe(500);
    expect(r.estimado).toBe(false);
  });

  it("marca estimado cuando falta el tipo de cambio", () => {
    const r = sumarPipelineMxn([{ monto: 100, moneda: "USD" }], null);
    expect(r.mxn).toBe(0);
    expect(r.sinConvertir).toBe(1);
    expect(r.estimado).toBe(true);
  });

  it("marca estimado cuando el T/C es de respaldo", () => {
    const r = sumarPipelineMxn([{ monto: 100, moneda: "USD" }], { ...TC, esFallback: true });
    expect(r.mxn).toBe(1800);
    expect(r.estimado).toBe(true);
  });

  it("no marca estimado con T/C de respaldo si todo es MXN", () => {
    const r = sumarPipelineMxn([{ monto: 100, moneda: "MXN" }], { ...TC, esFallback: true });
    expect(r.estimado).toBe(false);
  });
});
