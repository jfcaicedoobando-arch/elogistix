/**
 * Regresión v13.823.342:
 * - MXN sin IVA efectivo no debe imprimir "+ IVA" ni columna IVA.
 * - Las notas por renglón pasan por el filtro de notas internas.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CotizacionDocument } from "../CotizacionDocument";
import { makeCotizacionRow } from "@/test/fixtures/cotizacionFactory";

function concepto(over: Record<string, unknown> = {}) {
  return {
    descripcion: "Flete marítimo",
    unidad_medida: "servicio",
    cantidad: 1,
    precio_unitario: 1000,
    moneda: "MXN",
    aplica_iva: false,
    tasa_iva_aplicada: 0,
    notas: "",
    ...over,
  };
}

describe("CotizacionDocument — IVA real y notas internas", () => {
  it("MXN a tasa 0%/exento: sin '+ IVA' ni columna IVA", () => {
    const c = makeCotizacionRow({
      conceptos_venta: [concepto()] as never,
    });
    const text = render(<CotizacionDocument cotizacion={c} tasaIva={0.16} />).container.textContent ?? "";
    expect(text).toContain("Conceptos en MXN");
    expect(text).not.toContain("Conceptos en MXN + IVA");
    expect(text).not.toContain("IVA (16%)");
    expect(text).not.toMatch(/\bIVA\b/);
  });

  it("MXN con IVA al 8%: muestra '+ IVA' y la tasa real en totales", () => {
    const c = makeCotizacionRow({
      conceptos_venta: [concepto({ aplica_iva: true, tasa_iva_aplicada: 0.08 })] as never,
    });
    const text = render(<CotizacionDocument cotizacion={c} tasaIva={0.16} />).container.textContent ?? "";
    expect(text).toContain("Conceptos en MXN + IVA");
    expect(text).toContain("IVA (8%) MXN");
  });

  it("no imprime notas internas de renglón ni residuos de QA", () => {
    const c = makeCotizacionRow({
      notas: "[interno] revisar margen\nVigencia sujeta a espacio.",
      conceptos_venta: [
        concepto({ notas: "QA SMOKE 2026 cambio B" }),
        concepto({ descripcion: "Maniobras", notas: "Incluye 2 maniobras." }),
      ] as never,
    });
    const text = render(<CotizacionDocument cotizacion={c} tasaIva={0.16} />).container.textContent ?? "";
    expect(text).not.toContain("QA SMOKE");
    expect(text).not.toContain("revisar margen");
    expect(text).toContain("Incluye 2 maniobras.");
    expect(text).toContain("Vigencia sujeta a espacio.");
  });
});
