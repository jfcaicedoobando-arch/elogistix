import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ProformaConFactura } from "@/features/proformas/services";
import { renderEstado } from "../historialProformasCeldas";

function proforma(estadoCliente: "pendiente" | "aceptada"): ProformaConFactura {
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
    expect(screen.getByText("Pendiente aprobación interna")).toBeInTheDocument();
  });

  it("marca como interna la aprobación de clientes de casa", () => {
    const row = proforma("aceptada");
    render(renderEstado(row, [row], [], false));
    expect(screen.getByText("Aprobada internamente")).toBeInTheDocument();
  });

  it("conserva el estado de envío externo para clientes que sí autorizan", () => {
    const row = proforma("pendiente");
    render(renderEstado(row, [row], [], true));
    expect(screen.getByText("Enviada al cliente")).toBeInTheDocument();
  });
});
