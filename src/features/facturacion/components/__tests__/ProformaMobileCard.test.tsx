/** Tarjeta móvil del tab Proformas muestra folio, cliente, fecha y estado. */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProformaMobileCard } from "../ProformaMobileCard";
import { proformaFixture as proforma } from "./fixtures/proforma";

describe("ProformaMobileCard", () => {
  it("muestra folio, cliente, fecha y estado", () => {
    render(<ProformaMobileCard proforma={proforma()} />);
    expect(screen.getByText("P-0001")).toBeInTheDocument();
    expect(screen.getByText("Cliente Dos")).toBeInTheDocument();
    expect(screen.getByText(/Pendiente/i)).toBeInTheDocument();
  });

  it("muestra el pendiente interno en la tarjeta móvil", () => {
    render(
      <ProformaMobileCard
        proforma={proforma({
          estado_cliente: "pendiente",
          requiere_autorizacion_proforma: false,
        })}
      />,
    );
    expect(screen.getByText("Pendiente aprobación interna")).toBeInTheDocument();
  });

  it("identifica la aprobación interna cuando la proforma ya está autorizada", () => {
    render(
      <ProformaMobileCard
        proforma={proforma({
          estado_cliente: "aceptada",
          requiere_autorizacion_proforma: false,
        })}
      />,
    );
    expect(screen.getByText("Aprobada internamente")).toBeInTheDocument();
  });

  // R170-01: una proforma convertida cuya única factura sigue en Borrador
  // (sin UUID fiscal) no debe leerse como "Facturada".
  it("no muestra 'Facturada' cuando la única factura asociada está en Borrador", () => {
    render(
      <ProformaMobileCard
        proforma={proforma({
          estado_proforma: "facturada",
          factura_id: "f1",
          facturas_asociadas: [{ id: "f1", estado: "borrador", uuid_fiscal: null, deleted_at: null }],
        })}
      />,
    );
    expect(screen.getByText("Convertida a borrador")).toBeInTheDocument();
    expect(screen.queryByText("Facturada")).not.toBeInTheDocument();
  });
});
