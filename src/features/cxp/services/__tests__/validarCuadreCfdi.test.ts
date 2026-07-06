import { describe, it, expect } from "vitest";
import { validarCuadreCfdi } from "../validarCuadreCfdi";
import type { CfdiParsedResponse } from "../parseCfdi.types";

function makeCfdi(overrides: Partial<CfdiParsedResponse["cfdi"]> = {}): CfdiParsedResponse["cfdi"] {
  return {
    uuid: "u", serie: "A", folio: "1", fecha: "2026-01-01",
    moneda: "MXN", tipo_cambio: 1,
    subtotal: 10000, total: 11832,
    iva_trasladado: 1632, ieps_trasladado: 200, retenciones: 0,
    emisor: { rfc: "X", nombre: "X", regimen: "601" },
    receptor: { rfc: "Y", nombre: "Y" },
    conceptos: [
      { descripcion: "Flete", importe: 10000, iva: 1632, ieps: 200 },
    ],
    ...overrides,
  };
}

describe("validarCuadreCfdi", () => {
  it("acepta un CFDI donde el desglose coincide con los totales", () => {
    expect(validarCuadreCfdi(makeCfdi()).ok).toBe(true);
  });

  it("tolera diferencias ≤ 0.02 por redondeo", () => {
    const r = validarCuadreCfdi(
      makeCfdi({ subtotal: 10000.01, total: 11832.01 }),
    );
    expect(r.ok).toBe(true);
  });

  it("rechaza cuando los importes por concepto no cuadran con el subtotal", () => {
    const r = validarCuadreCfdi(
      makeCfdi({ conceptos: [{ descripcion: "F", importe: 9000, iva: 1632, ieps: 200 }] }),
    );
    expect(r.ok).toBe(false);
    expect(r.errores.join(" ")).toMatch(/subtotal/i);
  });

  it("rechaza cuando la suma de IVA por concepto no cuadra con IVA trasladado", () => {
    const r = validarCuadreCfdi(
      makeCfdi({ conceptos: [{ descripcion: "F", importe: 10000, iva: 1500, ieps: 200 }] }),
    );
    expect(r.ok).toBe(false);
    expect(r.errores.join(" ")).toMatch(/IVA/);
  });

  it("rechaza cuando la suma de IEPS por concepto no cuadra con IEPS trasladado", () => {
    const r = validarCuadreCfdi(
      makeCfdi({ conceptos: [{ descripcion: "F", importe: 10000, iva: 1632, ieps: 100 }] }),
    );
    expect(r.ok).toBe(false);
    expect(r.errores.join(" ")).toMatch(/IEPS/);
  });

  it("rechaza cuando subtotal + IVA + IEPS − retenciones ≠ total", () => {
    const r = validarCuadreCfdi(makeCfdi({ total: 12000 }));
    expect(r.ok).toBe(false);
    expect(r.errores.join(" ")).toMatch(/total/i);
  });

  it("rechaza CFDI sin conceptos", () => {
    const r = validarCuadreCfdi(makeCfdi({ conceptos: [] }));
    expect(r.ok).toBe(false);
    expect(r.errores.join(" ")).toMatch(/conceptos/i);
  });

  it("valida correctamente con retenciones", () => {
    const r = validarCuadreCfdi(
      makeCfdi({
        subtotal: 10000, iva_trasladado: 1600, ieps_trasladado: 0, retenciones: 400,
        total: 11200,
        conceptos: [{ descripcion: "F", importe: 10000, iva: 1600, ieps: 0 }],
      }),
    );
    expect(r.ok).toBe(true);
  });
});
