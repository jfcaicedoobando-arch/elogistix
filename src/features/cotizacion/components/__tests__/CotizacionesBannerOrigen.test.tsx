/**
 * Regresión (v13.823.326): el aviso de origen pertenece sólo a la lista de
 * cotizaciones y no debe cubrir el wizard al navegar a /cotizaciones/nueva.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CotizacionesBannerOrigen } from "../CotizacionesBannerOrigen";

const aviso = /Los embarques se crean desde una cotización aceptada/i;

function renderEn(pathname: string, origen?: string) {
  render(
    <MemoryRouter initialEntries={[{ pathname, state: origen ? { origen } : null }]}>
      <CotizacionesBannerOrigen />
    </MemoryRouter>,
  );
}

describe("CotizacionesBannerOrigen", () => {
  it("muestra el aviso en la lista al llegar desde Embarques", () => {
    renderEn("/cotizaciones", "nuevo-embarque");
    expect(screen.getByText(aviso)).toBeInTheDocument();
  });

  it("no muestra el aviso en el wizard aunque conserve el estado de navegación", () => {
    renderEn("/cotizaciones/nueva", "nuevo-embarque");
    expect(screen.queryByText(aviso)).not.toBeInTheDocument();
  });

  it("permite cerrar el aviso local", () => {
    renderEn("/cotizaciones", "nuevo-embarque");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(screen.queryByText(aviso)).not.toBeInTheDocument();
  });

  it("no muestra el aviso al entrar directamente a la lista", () => {
    renderEn("/cotizaciones");
    expect(screen.queryByText(aviso)).not.toBeInTheDocument();
  });
});