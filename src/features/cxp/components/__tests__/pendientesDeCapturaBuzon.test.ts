/**
 * v13.507.0 — Pendientes extra del modo buzón (avisos que no bloquean).
 */
import { describe, it, expect } from "vitest";
import { pendientesDeCaptura } from "@/features/cxp/components/pendientesDeCaptura";
import type { FacturaFormValues } from "@/features/cxp/types";

const base = {
  provId: "p1", folio: "A1", fecha: "2026-01-10", vence: "2026-02-10",
  moneda: "MXN", subtotal: "1000", iva: "160", notas: "",
} as unknown as FacturaFormValues;

describe("pendientesDeCaptura — modo buzón", () => {
  it("avisa cuando el importe no coincide con lo declarado", () => {
    const faltan = pendientesDeCaptura({
      values: base, total: 1160,
      avisoMontoDeclarado: { montoDeclarado: 500, monedaDeclarada: "MXN" },
    });
    expect(faltan).toContain("El importe no coincide con lo declarado");
  });

  it("no avisa cuando el importe cuadra", () => {
    const faltan = pendientesDeCaptura({
      values: base, total: 1160,
      avisoMontoDeclarado: { montoDeclarado: 1000, monedaDeclarada: "MXN" },
    });
    expect(faltan).not.toContain("El importe no coincide con lo declarado");
  });

  it("avisa cuando no se vinculó ningún costo del embarque", () => {
    const faltan = pendientesDeCaptura({ values: base, total: 1160, sinVinculos: true });
    expect(faltan).toContain("Sin costos del embarque vinculados");
  });
});
