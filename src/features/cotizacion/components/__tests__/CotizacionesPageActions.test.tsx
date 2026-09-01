/**
 * P3 (v13.819.1) — Con cero resultados filtrados, "Exportar CSV" seguía
 * habilitado y generaba un archivo vacío.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CotizacionesPageActions } from "../CotizacionesPageActions";

function montar(totalFiltrado: number, onExportar = vi.fn()) {
  render(
    <MemoryRouter>
      <CotizacionesPageActions canEdit totalFiltrado={totalFiltrado} onExportar={onExportar} onNueva={vi.fn()} />
    </MemoryRouter>,
  );
  return { onExportar, boton: screen.getByRole("button", { name: /Exportar CSV/i }) };
}

describe("CotizacionesPageActions · Exportar CSV", () => {
  it("con cero resultados queda deshabilitado y explica la causa", () => {
    const { boton, onExportar } = montar(0);
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute("aria-describedby", "exportar-csv-motivo");
    expect(
      screen.getByText("No hay cotizaciones que exportar con los filtros actuales."),
    ).toBeInTheDocument();

    fireEvent.click(boton);
    expect(onExportar).not.toHaveBeenCalled();
  });

  it("con resultados exporta normalmente", () => {
    const { boton, onExportar } = montar(3);
    expect(boton).not.toBeDisabled();
    fireEvent.click(boton);
    expect(onExportar).toHaveBeenCalledTimes(1);
  });
});
