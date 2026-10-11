import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EstadoBadges } from "../ProformaEstadoBadges";

describe("EstadoBadges (V-11)", () => {
  it.each(["pendiente", "aceptada", "rechazada"] as const)(
    "prioriza Cancelada frente a respuesta %s y facturas históricas",
    (estadoCliente) => {
      render(<EstadoBadges estadoProforma="cancelada" estadoCliente={estadoCliente}
        facturas={[{ estado: "Emitida" }]} aceptadaPor="manual:operador@example.test" />);
      expect(screen.getByText("Cancelada")).toBeTruthy();
      expect(screen.getByText("Facturación histórica: Facturada")).toBeTruthy();
      expect(screen.queryByText("Pendiente cliente")).toBeNull();
      expect(screen.queryByText("Rechazada por cliente")).toBeNull();
      expect(screen.queryByText("Aceptada")).toBeNull();
      if (estadoCliente === "aceptada") expect(screen.getByText("Aceptación manual")).toBeTruthy();
    },
  );

  it("mantiene la conversión histórica a borrador separada de la cancelación", () => {
    render(<EstadoBadges estadoProforma="cancelada" estadoCliente="aceptada"
      facturas={[{ estado: "Borrador" }]} requiereAutorizacionProforma={false} />);
    expect(screen.getByText("Cancelada")).toBeTruthy();
    expect(screen.getByText("Facturación histórica: Convertida a borrador")).toBeTruthy();
    expect(screen.queryByText("Aprobada internamente")).toBeNull();
  });

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
