/**
 * Regresión (v13.823.336): una fila decía "En proforma" mientras el stepper
 * decía "Sin proformas". La bandera `estado_facturacion` sólo manda cuando el
 * embarque sí tiene proformas vivas: es la única fuente de verdad visible.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  calcularEstadosConceptos,
  EstadoConceptoBadge,
} from "@/features/embarques/components/facturacion/estadoConceptoBadge";
import type { Tables } from "@/types/db";

type ConceptoVenta = Tables<"conceptos_venta">;

const concepto = (id: string, estado: string) =>
  ({ id, estado_facturacion: estado } as unknown as ConceptoVenta);

describe("calcularEstadosConceptos", () => {
  it("con proformas vivas respeta la bandera de la base", () => {
    const mapa = calcularEstadosConceptos([concepto("c1", "en_proforma")], true);
    expect(mapa.get("c1")).toBe("en_proforma");
  });

  it("sin proformas degrada la bandera huérfana a pendiente", () => {
    const mapa = calcularEstadosConceptos([concepto("c1", "en_proforma")], false);
    expect(mapa.get("c1")).toBe("pendiente");
  });

  // v13.823.366 — En Borrador el concepto no puede pasar a proforma.
  it("en Borrador marca los pendientes como pendiente_confirmar", () => {
    const mapa = calcularEstadosConceptos([concepto("c1", "pendiente")], false, false);
    expect(mapa.get("c1")).toBe("pendiente_confirmar");
  });

  it("confirmado vuelve a la semántica pendiente", () => {
    const mapa = calcularEstadosConceptos([concepto("c1", "pendiente")], false, true);
    expect(mapa.get("c1")).toBe("pendiente");
  });

  it("nunca degrada un concepto ya facturado", () => {
    const mapa = calcularEstadosConceptos([concepto("c1", "facturado")], false);
    expect(mapa.get("c1")).toBe("facturado");
  });
});

describe("EstadoConceptoBadge", () => {
  it("usa etiquetas inequívocas", () => {
    const { unmount } = render(<EstadoConceptoBadge estado="pendiente" />);
    expect(screen.getByText("Listo para proforma")).toBeInTheDocument();
    unmount();
    const b = render(<EstadoConceptoBadge estado="pendiente_confirmar" />);
    expect(screen.getByText("Pendiente de confirmar")).toBeInTheDocument();
    b.unmount();
    render(<EstadoConceptoBadge estado="en_proforma" />);
    expect(screen.getByText("Proforma generada")).toBeInTheDocument();
  });
});
