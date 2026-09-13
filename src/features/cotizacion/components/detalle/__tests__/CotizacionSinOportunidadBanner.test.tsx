/**
 * v13.823.349 — el banner recibía el `canEdit` amplio (incluye finanzas) y
 * mostraba "Editar y vincular" a contabilidad/tesorería, aunque el formulario y
 * la RPC exigen escritura de cotizaciones.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CotizacionSinOportunidadBanner } from "../CotizacionSinOportunidadBanner";

function renderBanner(canWriteCotizaciones: boolean) {
  render(
    <MemoryRouter>
      <CotizacionSinOportunidadBanner cotizacionId="c1" canWriteCotizaciones={canWriteCotizaciones} />
    </MemoryRouter>,
  );
}

describe("CotizacionSinOportunidadBanner", () => {
  it("muestra la acción cuando el rol puede escribir cotizaciones", () => {
    renderBanner(true);
    expect(screen.getByText(/Sin oportunidad en el CRM/)).toBeInTheDocument();
    expect(screen.getByRole("link")).toBeInTheDocument();
  });

  it("deja el aviso en sólo lectura para finanzas", () => {
    renderBanner(false);
    expect(screen.getByText(/Sin oportunidad en el CRM/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
