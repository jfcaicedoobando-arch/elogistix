import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CotizacionDetalleEmbarques } from "@/features/cotizacion/components/CotizacionDetalleEmbarques";

const embarque: { id: string; expediente: string | null; estado: string; created_at: string } = {
  id: "emb-1",
  expediente: "ELABC0001",
  estado: "Borrador",
  created_at: "2026-09-01T12:00:00.000Z",
};

function renderCard(embarques = [embarque], estado = "En operación", puedeCrearEmbarque = false) {
  return render(
    <MemoryRouter>
      <CotizacionDetalleEmbarques
        embarques={embarques}
        cotizacionEstado={estado}
        puedeCrearEmbarque={puedeCrearEmbarque}
      />
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
    expect(screen.getByText(/aquí no\s+se muestra ningún embarque/i)).toBeInTheDocument();
  });

  it("sin permiso explica que el embarque puede existir y no verse", () => {
    renderCard([], "En operación", false);
    expect(screen.getByText(/no tenga permiso para consultarlo/i)).toBeInTheDocument();
    expect(screen.queryByText(/Crear embarque/i)).toBeNull();
  });

  it("con permiso sí guía a la acción Crear embarque", () => {
    renderCard([], "En operación", true);
    expect(screen.getByText(/Crear embarque/i)).toBeInTheDocument();
  });

  it("usa el fallback de borrador cuando el expediente viene vacío", () => {
    renderCard([{ ...embarque, expediente: null }]);
    expect(screen.getByRole("link", { name: /abrir embarque Borrador emb-1/i })).toBeInTheDocument();
  });

  it("sin embarques y con estado que no los sugiere no renderiza la tarjeta", () => {
    const { container } = renderCard([], "Borrador");
    expect(container).toBeEmptyDOMElement();
  });
});
