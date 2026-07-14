import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmbarqueStatusChip, resolveFinancieroInfo } from "../EmbarqueStatusChip";

describe("resolveFinancieroInfo", () => {
  it("prioriza 'Cobrado' cuando cobro=pagado", () => {
    expect(resolveFinancieroInfo(true, "pagado")).toEqual({ label: "Cobrado", tone: "success" });
    // incluso si no hay proforma marcada (edge)
    expect(resolveFinancieroInfo(false, "pagado")).toEqual({ label: "Cobrado", tone: "success" });
  });

  it("muestra 'Cobro parcial' cuando cobro=parcial", () => {
    expect(resolveFinancieroInfo(true, "parcial")).toEqual({ label: "Cobro parcial", tone: "neutral" });
  });

  it("muestra 'Sin proforma' cuando no hay proforma y cobro=pendiente/null", () => {
    expect(resolveFinancieroInfo(false, "pendiente")).toEqual({ label: "Sin proforma", tone: "warning" });
    expect(resolveFinancieroInfo(false, null)).toEqual({ label: "Sin proforma", tone: "warning" });
    expect(resolveFinancieroInfo(null, undefined)).toEqual({ label: "Sin proforma", tone: "warning" });
  });

  it("muestra 'Proforma' cuando hay proforma pero aún no hay cobro", () => {
    expect(resolveFinancieroInfo(true, "pendiente")).toEqual({ label: "Proforma", tone: "neutral" });
    expect(resolveFinancieroInfo(true, null)).toEqual({ label: "Proforma", tone: "neutral" });
  });
});

describe("<EmbarqueStatusChip />", () => {
  it("renderiza estado, modo y sub-estado financiero en un solo chip", () => {
    render(
      <EmbarqueStatusChip
        estado="En Tránsito"
        modo="Marítimo"
        tieneProforma={true}
        cobroStatus="pendiente"
      />,
    );
    expect(screen.getByText("En Tránsito")).toBeInTheDocument();
    expect(screen.getByText("Marítimo")).toBeInTheDocument();
    expect(screen.getByText("Proforma")).toBeInTheDocument();
  });

  it("cambia el label financiero según el estado más avanzado", () => {
    const { rerender } = render(
      <EmbarqueStatusChip estado="Cerrado" modo="Aéreo" tieneProforma={true} cobroStatus="pagado" />,
    );
    expect(screen.getByText("Cobrado")).toBeInTheDocument();

    rerender(
      <EmbarqueStatusChip estado="Booking" modo="Terrestre" tieneProforma={false} cobroStatus={null} />,
    );
    expect(screen.getByText("Sin proforma")).toBeInTheDocument();
  });
});
