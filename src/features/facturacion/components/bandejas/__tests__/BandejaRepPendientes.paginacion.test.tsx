import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
import { BandejaRepPendientes } from "../BandejaRepPendientes";

const { fetchPage, timbrar } = vi.hoisted(() => ({ fetchPage: vi.fn(), timbrar: vi.fn() }));
vi.mock("@/lib/contexts/OrganizationContext", () => ({
  useOrganization: () => ({ organizationId: "org-a", loading: false }),
}));
vi.mock("@/features/facturacion/services/bandejas", () => ({
  fetchPagosRepPendientes: fetchPage,
  REP_PENDIENTES_SORT_KEYS: ["factura", "cliente", "fecha_pago", "monto", "estado"],
}));
vi.mock("@/features/facturacion/hooks/useTimbrarRepsLote", () => ({
  useTimbrarRepsLote: () => ({ timbrar, enProceso: false, progreso: null }),
}));

it("conserva la selección por ID al pasar a otra página con un total remoto mayor de 500", async () => {
  fetchPage.mockImplementation((_org: string, { range }: { range: { from: number } }) => Promise.resolve({
    count: 620,
    rows: [{
      id: `rep-${range.from}`, factura_id: `factura-${range.from}`, factura_numero: `F-${range.from}`,
      cliente_nombre: "Cliente", fecha_pago: "2026-10-13", monto: 100, moneda: "MXN", estado_rep: "Pendiente",
    }],
  }));
  timbrar.mockResolvedValue({});
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter hasMemory>
        <MemoryRouter><BandejaRepPendientes /></MemoryRouter>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );

  await waitFor(() => expect(screen.getByText(/de 620 complementos pendientes/)).toBeInTheDocument());
  fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar fila" }));
  fireEvent.click(screen.getByRole("button", { name: "Última página" }));
  await waitFor(() => expect(fetchPage).toHaveBeenCalledWith("org-a", expect.objectContaining({
    range: { from: 600, to: 699 },
  })));
  expect(await screen.findByRole("button", { name: "Timbrar REP de la factura F-600" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar fila" }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Timbrar REP seleccionados" }));
  });
  expect(timbrar).toHaveBeenCalledWith(["rep-0", "rep-600"]);
  expect(screen.queryByRole("button", { name: "Timbrar REP seleccionados" })).not.toBeInTheDocument();
});
