import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { HistorialFacturas } from "../HistorialFacturas";
import { HistorialProformas } from "../HistorialProformas";
import type { ProformaConFactura } from "@/features/proformas/services";

const callbacks = { onEliminar: vi.fn(), onDescargar: vi.fn() };
function RutaActual() {
  return <output data-testid="ruta">{useLocation().pathname}</output>;
}

describe("historial de facturación del embarque", () => {
  it("conserva títulos y mensajes vacíos sin dibujar tablas sin registros", () => {
    render(<MemoryRouter>
      <HistorialProformas proformas={[]} canEdit={false} isDeleting={false} {...callbacks} />
      <HistorialFacturas facturas={[]} proformas={[]} />
    </MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Proformas Generadas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Facturas del Embarque" })).toBeInTheDocument();
    expect(screen.getByText("No hay proformas generadas para este embarque.")).toBeInTheDocument();
    expect(screen.getByText("No hay facturas generadas para este embarque.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("mantiene filas, importes y enlaces cuando existen documentos", () => {
    const proforma = { id: "p1", numero: "PRO-2026-0012", fecha_emision: "2026-09-30",
      total_mxn: 100, total_usd: 0, dias_credito: 30, estado_proforma: "pendiente",
      estado_revision: "aprobada", estado_aprobacion: "aprobada", estado_cliente: "pendiente",
    } as ProformaConFactura;
    render(<MemoryRouter>
      <RutaActual />
      <HistorialProformas proformas={[proforma]} canEdit={false} isDeleting={false} {...callbacks} />
      <HistorialFacturas facturas={[{ id: "f1", numero: "F-0012", total: 116, moneda: "MXN",
        fecha_emision: "2026-09-30", estado: "Emitida", proforma_id: "p1" }]} proformas={[proforma]} />
    </MemoryRouter>);
    expect(screen.getAllByRole("table")).toHaveLength(2);
    fireEvent.click(screen.getByRole("link", { name: /F-0012/ }));
    expect(screen.getByTestId("ruta")).toHaveTextContent("/facturacion/f1");
    fireEvent.click(within(screen.getAllByRole("table")[0]).getByRole("link", { name: /PRO-2026-0012/ }));
    expect(screen.getByTestId("ruta")).toHaveTextContent("/proformas/p1");
    expect(screen.queryByText(/No hay facturas/)).not.toBeInTheDocument();
  });
});
