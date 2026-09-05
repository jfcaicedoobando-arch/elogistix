import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CotizacionDetalleEmbarques } from "@/features/cotizacion/components/CotizacionDetalleEmbarques";

const embarque = {
  id: "emb-1",
  expediente: "ELABC0001",
  estado: "Borrador",
  created_at: "2026-09-01T12:00:00.000Z",
};

function renderCard(embarques = [embarque], estado = "En operación") {
  return render(
    <MemoryRouter>
      <CotizacionDetalleEmbarques embarques={embarques} cotizacionEstado={estado} />
    </MemoryRouter>,
  );
}

describe("CotizacionDetalleEmbarques · accesibilidad por teclado", () => {
  it("cada embarque es un enlace enfocable con aria-label descriptivo", () => {
    renderCard();
    const link = screen.getByRole("link", { name: /abrir embarque ELABC0001 \(Borrador\)/i });
    expect(link).toHaveAttribute("href", "/embarques/emb-1");
    link.focus();
    expect(link).toHaveFocus();
  });

  it("sin embarques y con estado que los sugiere muestra el aviso, no enlaces", () => {
    renderCard([], "Cerrada");
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(/no hay embarques vinculados/i)).toBeInTheDocument();
  });

  it("sin embarques y con estado que no los sugiere no renderiza la tarjeta", () => {
    const { container } = renderCard([], "Borrador");
    expect(container).toBeEmptyDOMElement();
  });
});
