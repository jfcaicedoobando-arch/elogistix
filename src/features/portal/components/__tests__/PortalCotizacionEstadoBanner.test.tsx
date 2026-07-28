import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PortalCotizacionEstadoBanner from "../cotizacion/PortalCotizacionEstadoBanner";

function renderBanner(props: Parameters<typeof PortalCotizacionEstadoBanner>[0]) {
  return render(
    <MemoryRouter>
      <PortalCotizacionEstadoBanner {...props} />
    </MemoryRouter>,
  );
}

describe("PortalCotizacionEstadoBanner (B-103)", () => {
  it("muestra la fecha de aceptación date-only sin hora falsa", () => {
    renderBanner({ estado: "Aceptada", fechaAceptacion: "2026-07-20" });
    expect(screen.getByText("20/07/2026")).toBeInTheDocument();
    expect(screen.queryByText(/00:00/)).not.toBeInTheDocument();
  });

  it("muestra hora cuando el timestamp la incluye", () => {
    renderBanner({ estado: "Aceptada", fechaAceptacion: "2026-07-20T15:30:00" });
    expect(screen.getByText(/20\/07\/2026 15:30/)).toBeInTheDocument();
  });

  it("muestra la fecha de rechazo cuando la cotización fue rechazada", () => {
    renderBanner({ estado: "Rechazada", fechaRechazo: "2026-07-21", comentarioCliente: "Muy caro" });
    expect(screen.getByText(/Rechazaste esta cotización/)).toBeInTheDocument();
    expect(screen.getByText("21/07/2026")).toBeInTheDocument();
    expect(screen.getByText(/Muy caro/)).toBeInTheDocument();
  });

  it("prioriza el banner de embarque vinculado sobre el estado", () => {
    renderBanner({ estado: "Aceptada", embarqueId: "e1", embarqueExpediente: "00315" });
    expect(screen.getByText(/ya está en operación/)).toBeInTheDocument();
    expect(screen.getByText(/Embarque 00315/)).toBeInTheDocument();
  });

  it("no pinta nada en estados sin mensaje (Borrador)", () => {
    const { container } = renderBanner({ estado: "Borrador" });
    expect(container).toBeEmptyDOMElement();
  });
});
