/**
 * Fase 3 — contexto puro reubicado a features/embarques/contexts/.
 * Valida default y que el Provider propaga el valor a consumidores.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { useContext } from "react";
import {
  CotizacionVinculadaContext,
  type CotizacionVinculadaCtx,
} from "../cotizacionVinculadaContext";

function Probe() {
  const ctx = useContext(CotizacionVinculadaContext);
  return <span data-testid="v">{ctx.cotizacion ? ctx.cotizacion.id : "null"}</span>;
}

describe("CotizacionVinculadaContext", () => {
  it("default expone cotizacion = null", () => {
    render(<Probe />);
    expect(screen.getByTestId("v").textContent).toBe("null");
  });

  it("Provider propaga la cotización vinculada al consumidor", () => {
    const value: CotizacionVinculadaCtx = {
      // SAFE-CAST: fixture mínimo, sólo necesitamos el id para la prueba.
      cotizacion: { id: "cot-123" } as CotizacionVinculadaCtx["cotizacion"],
    };
    render(
      <CotizacionVinculadaContext.Provider value={value}>
        <Probe />
      </CotizacionVinculadaContext.Provider>,
    );
    expect(screen.getByTestId("v").textContent).toBe("cot-123");
  });
});
