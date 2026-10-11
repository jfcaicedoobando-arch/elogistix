import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ProformaDetalleHeader } from "../detalle/ProformaDetalleHeader";

describe("ProformaDetalleHeader cancelada", () => {
  it.each(["pendiente", "aceptada", "rechazada"] as const)(
    "conecta el estado terminal al badge y al stepper con respuesta %s",
    (estadoCliente) => {
      render(<MemoryRouter><ProformaDetalleHeader
        numero="PRO-2026-0018" estadoProforma="cancelada" estadoCliente={estadoCliente}
        aceptadaPor={null} clienteNombre="Cliente de prueba" expediente="ELNAC00020"
        facturada facturas={[{ estado: "Emitida" }]} enviadaAt="2026-10-01"
      /></MemoryRouter>);
      expect(screen.getByLabelText("Estado: Cancelada")).toHaveTextContent("Cancelada");
      expect(screen.getAllByText("Cancelada")).toHaveLength(2);
      expect(screen.queryByLabelText("Ciclo de vida del documento")).toBeNull();
      expect(screen.getByText("Facturación histórica: Facturada")).toBeTruthy();
      expect(screen.queryByText("Pendiente cliente")).toBeNull();
    },
  );
});
