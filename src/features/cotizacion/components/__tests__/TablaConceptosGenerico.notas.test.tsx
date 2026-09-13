/**
 * v13.823.345 — Regresión: notas internas fuera del detalle del cliente y keys
 * estables con descripciones duplicadas.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TablaConceptosGenerico from "../TablaConceptosGenerico";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/types";

vi.mock("@/features/catalogos/hooks", () => ({ useTasaIVA: () => 0.16 }));

function concepto(over: Partial<ConceptoVentaCotizacion> = {}): ConceptoVentaCotizacion {
  return {
    descripcion: "Flete marítimo",
    unidad_medida: "Contenedor",
    cantidad: 1,
    precio_unitario: 1000,
    moneda: "MXN",
    total: 1160,
    aplica_iva: true,
    tasa_iva_aplicada: 0.16,
    ...over,
  };
}

describe("TablaConceptosGenerico — notas", () => {
  it("no muestra notas internas ni residuos de QA", () => {
    render(
      <TablaConceptosGenerico
        moneda="MXN"
        conceptos={[concepto({ notas: "[interno] QA SMOKE revisar" })]}
        total={1160}
      />,
    );
    expect(screen.queryByText(/QA SMOKE/)).toBeNull();
  });

  it("conserva las notas públicas", () => {
    render(
      <TablaConceptosGenerico
        moneda="MXN"
        conceptos={[concepto({ notas: "Incluye maniobras" })]}
        total={1160}
      />,
    );
    expect(screen.getByText(/Incluye maniobras/)).toBeTruthy();
  });

  it("renderiza filas con descripción duplicada sin colisión de keys", () => {
    const avisos: unknown[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => { avisos.push(args); });
    render(
      <TablaConceptosGenerico
        moneda="MXN"
        conceptos={[concepto({ notas: "A" }), concepto({ notas: "B" })]}
        total={2320}
      />,
    );
    expect(screen.getByText(/↳ A/)).toBeTruthy();
    expect(screen.getByText(/↳ B/)).toBeTruthy();
    expect(avisos).toHaveLength(0);
    spy.mockRestore();
  });
});
