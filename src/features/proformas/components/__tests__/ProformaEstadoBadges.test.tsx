import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EstadoBadges } from "../ProformaEstadoBadges";

describe("EstadoBadges (V-11)", () => {
  it("distingue aprobación interna de una respuesta pendiente del cliente", () => {
    render(
      <EstadoBadges
        estadoCliente="pendiente"
        requiereAutorizacionProforma={false}
      />,
    );
    expect(screen.getByText("Pendiente aprobación interna")).toBeTruthy();
    expect(screen.queryByText("Pendiente cliente")).toBeNull();
  });

  it("identifica como interna la aprobación de clientes sin autorización externa", () => {
    render(
      <EstadoBadges
        estadoCliente="aceptada"
        requiereAutorizacionProforma={false}
      />,
    );
    expect(screen.getByText("Aprobada internamente")).toBeTruthy();
    expect(screen.queryByText("Origen no registrado")).toBeNull();
  });

  it("conserva el estado de espera del cliente cuando sí requiere autorización", () => {
    render(<EstadoBadges estadoCliente="pendiente" />);
    expect(screen.getByText("Pendiente cliente")).toBeTruthy();
  });
});
