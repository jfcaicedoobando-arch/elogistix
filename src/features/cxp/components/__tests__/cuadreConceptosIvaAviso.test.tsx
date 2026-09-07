/**
 * R170-10 · El aviso de IVA de la barra de cuadre debe decir la verdad:
 * sólo puede afirmar "no desglosado por partida" cuando las partidas
 * realmente no traen IVA.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CuadreConceptosBar } from "@/features/cxp/components/CuadreConceptosBar";

const cuadrado = { suma: 2500, diferencia: 0, estado: "cuadrado" as const, puedeAprobar: true };

describe("CuadreConceptosBar · aviso de IVA (R170-10)", () => {
  it("con IVA sólo en la cabecera avisa que no está desglosado", () => {
    render(
      <CuadreConceptosBar
        resultado={cuadrado}
        subtotal={2500}
        moneda="MXN"
        ivaGlobal={400}
        ivaPartidas={0}
        totalDocumento={2900}
      />,
    );
    expect(screen.getByText(/no desglosado por partida/i)).toBeInTheDocument();
  });

  it("con IVA desglosado por partida que coincide, no acusa falta de desglose", () => {
    render(
      <CuadreConceptosBar
        resultado={cuadrado}
        subtotal={2500}
        moneda="MXN"
        ivaGlobal={400}
        ivaPartidas={400}
        totalDocumento={2900}
      />,
    );
    expect(screen.queryByText(/no desglosado por partida/i)).not.toBeInTheDocument();
    expect(screen.getByText(/ya desglosado en las partidas/i)).toBeInTheDocument();
  });

  it("si el IVA de partidas no coincide con la cabecera, muestra ambos montos", () => {
    render(
      <CuadreConceptosBar
        resultado={cuadrado}
        subtotal={2500}
        moneda="MXN"
        ivaGlobal={400}
        ivaPartidas={320}
        totalDocumento={2900}
      />,
    );
    expect(screen.getByText(/revisa la diferencia antes de aprobar/i)).toBeInTheDocument();
  });

  it("sin IVA no muestra explicación alguna", () => {
    render(
      <CuadreConceptosBar
        resultado={cuadrado}
        subtotal={2500}
        moneda="MXN"
        ivaGlobal={0}
        ivaPartidas={0}
        totalDocumento={2500}
      />,
    );
    expect(screen.queryByText(/IVA/i)).not.toBeInTheDocument();
  });
});
