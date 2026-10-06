import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ProformaConFactura } from "@/features/proformas/services";
import { renderEstado } from "../historialProformasCeldas";

function proforma(estadoCliente: "pendiente" | "aceptada" | "rechazada"): ProformaConFactura {
  return {
    id: "proforma-1",
    estado_proforma: "pendiente",
    estado_cliente: estadoCliente,
    estado_revision: "aprobada",
    estado_aprobacion: "aprobada",
    total_mxn: 100,
    total_usd: 0,
  } as unknown as ProformaConFactura;
}

describe("historial de proformas del embarque (V-11)", () => {
  it("muestra espera de aprobación interna para clientes sin autorización externa", () => {
    const row = proforma("pendiente");
    render(renderEstado(row, [row], [], false));
    expect(screen.getByText("Pendiente aprobación interna")).toHaveClass("bg-warning/15");
  });

  it("marca como interna la aprobación de clientes de casa", () => {
    const row = proforma("aceptada");
    render(renderEstado(row, [row], [], false));
    expect(screen.getByText("Aprobada internamente")).toHaveClass("bg-success/15");
  });

  it("conserva el color de rechazo sin autorización externa", () => {
    const row = proforma("rechazada");
    render(renderEstado(row, [row], [], false));
    expect(screen.getByText("Rechazada")).toHaveClass("bg-destructive");
  });

  it.each([true, false])("prioriza Cancelada aunque exista factura (autorización: %s)", (requiereAutorizacion) => {
    const row = { ...proforma("aceptada"), estado_proforma: "cancelada", factura_id: "factura-1" };
    render(renderEstado(row, [row], [], requiereAutorizacion));
    expect(screen.getByText("Cancelada")).toHaveClass("bg-destructive");
    expect(screen.queryByText("Convertida")).not.toBeInTheDocument();
  });

  it("conserva el estado de envío externo para clientes que sí autorizan", () => {
    const row = proforma("pendiente");
    render(renderEstado(row, [row], [], true));
    expect(screen.getByText("Enviada al cliente")).toBeInTheDocument();
  });
});
