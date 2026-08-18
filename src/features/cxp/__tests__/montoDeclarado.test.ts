/**
 * v13.507.0 — Cotejo entre lo que declaró operaciones y lo capturado.
 */
import { describe, it, expect } from "vitest";
import { cotejarMontoDeclarado } from "@/features/cxp/domain/montoDeclarado";

describe("cotejarMontoDeclarado", () => {
  it("sin datos cuando no hay monto declarado", () => {
    expect(
      cotejarMontoDeclarado({
        montoDeclarado: null, monedaDeclarada: "MXN", montoCapturado: 100, monedaCapturada: "MXN",
      }).estado,
    ).toBe("sin_datos");
  });

  it("no compara cuando las monedas difieren", () => {
    expect(
      cotejarMontoDeclarado({
        montoDeclarado: 100, monedaDeclarada: "USD", montoCapturado: 100, monedaCapturada: "MXN",
      }).estado,
    ).toBe("moneda_distinta");
  });

  it("coincide dentro de la tolerancia de 1%", () => {
    const r = cotejarMontoDeclarado({
      montoDeclarado: 1000, monedaDeclarada: "MXN", montoCapturado: 1009, monedaCapturada: "mxn",
    });
    expect(r.estado).toBe("coincide");
  });

  it("coincide por tolerancia absoluta de $1", () => {
    expect(
      cotejarMontoDeclarado({
        montoDeclarado: 10, monedaDeclarada: "MXN", montoCapturado: 10.8, monedaCapturada: "MXN",
      }).estado,
    ).toBe("coincide");
  });

  it("difiere del monto declarado y reporta diferencia y porcentaje", () => {
    const r = cotejarMontoDeclarado({
      montoDeclarado: 1000, monedaDeclarada: "MXN", montoCapturado: 1200, monedaCapturada: "MXN",
    });
    expect(r.estado).toBe("difiere");
    expect(r.diferencia).toBe(200);
    expect(r.porcentaje).toBeCloseTo(0.2, 5);
  });
});
