import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { ComprasPorAprobarMobileCard } from "@/features/compras/components/ComprasPorAprobarMobileCard";
import type { FacturaCxP } from "@/features/cxp/services";

vi.mock("@/hooks/shared", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useIsMobile: () => true,
}));

const factura = {
  id: "f1", folio_proveedor: "FP-1", folio_interno: "FI-1", proveedor_nombre: "Proveedor",
  fecha_vencimiento: null, total: 100, moneda: "MXN",
} as FacturaCxP;

describe("ComprasPorAprobar navegación móvil", () => {
  it("separa el checkbox del enlace de tarjeta y navega por click o teclado", () => {
    const onSelectedChange = vi.fn();
    render(
      <MemoryRouter initialEntries={["/compras/por-aprobar"]}>
        <Routes>
          <Route path="/compras/por-aprobar" element={(
            <ResponsiveDataTable
              columns={[]}
              data={[factura]}
              rowKey={(row) => row.id}
              getRowHref={(row) => `/compras/facturas/${row.id}`}
              getRowAriaLabel={() => "Abrir factura FP-1"}
              mobileCard={(row) => (
                <ComprasPorAprobarMobileCard row={row} seleccionable onSelectedChange={onSelectedChange} />
              )}
            />
          )} />
          <Route path="/compras/facturas/:id" element={<p>Detalle abierto</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(document.querySelector("button button")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: /Seleccionar factura FP-1/i }));
    expect(onSelectedChange).toHaveBeenCalledWith(true);
    expect(screen.queryByText("Detalle abierto")).not.toBeInTheDocument();

    const tarjeta = screen.getByRole("link", { name: "Abrir factura FP-1" });
    fireEvent.keyDown(tarjeta, { key: "Enter" });
    expect(screen.getByText("Detalle abierto")).toBeInTheDocument();
  });
});