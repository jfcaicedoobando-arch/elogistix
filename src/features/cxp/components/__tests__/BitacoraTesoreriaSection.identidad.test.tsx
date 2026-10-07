import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/features/auditoria/hooks/useBitacora", () => ({ useBitacora: mocks.query }));
vi.mock("@/features/tesoreria", () => ({ useCuentasBancarias: () => ({ data: [] }) }));
vi.mock("../BitacoraTesoreriaExportButtons", () => ({
  BitacoraTesoreriaExportButtons: ({ facturaId }: { facturaId: string }) => <div data-testid="export">{facturaId}</div>,
}));

import { BitacoraTesoreriaSection } from "../BitacoraTesoreriaSection";

describe("bitácora: identidad y snapshot de la misma factura", () => {
  it("no exporta las filas retenidas mientras cambia la factura consultada", () => {
    mocks.query.mockReturnValue({ data: { datos: [] }, isLoading: false, isPlaceholderData: true });
    render(<BitacoraTesoreriaSection facturaId="factura-b" monedaFactura="MXN" />);
    expect(screen.queryByTestId("export")).not.toBeInTheDocument();
    expect(mocks.query).toHaveBeenCalledWith(expect.objectContaining({ entidadId: "factura-b" }));
  });

  it("entrega al exportador el ID de la factura que produjo las filas", () => {
    mocks.query.mockReturnValue({ data: { datos: [] }, isLoading: false, isPlaceholderData: false });
    render(<BitacoraTesoreriaSection facturaId="factura-a" monedaFactura="MXN" />);
    expect(screen.getByTestId("export")).toHaveTextContent("factura-a");
  });
});
