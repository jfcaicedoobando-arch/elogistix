import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import Facturacion from "../Facturacion";

vi.mock("@/hooks/shared", () => ({
  usePermissions: () => ({ canEmitirFactura: false }),
  useDocumentTitle: vi.fn(),
}));
vi.mock("@/features/facturacion/hooks", () => ({
  useFacturacionDateRange: () => ({
    setRango: vi.fn(),
    limpiar: vi.fn(),
    isInRange: () => true,
  }),
  useFacturacionPageController: () => ({
    search: "",
    setSearch: vi.fn(),
    setFilter: vi.fn(),
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    paginatedFacturas: [],
    facturasFiltradas: [],
    clientesDisponibles: [],
  }),
}));
vi.mock(
  "@/features/facturacion/components/DashboardEjecutivoFacturacion",
  () => ({ DashboardEjecutivoFacturacion: () => null }),
);
vi.mock("@/features/facturacion/components/PeriodoFiscalSelector", () => ({
  PeriodoFiscalSelector: () => null,
}));
vi.mock("@/features/facturacion/components/FacturacionDialogs", () => ({
  FacturacionDialogs: () => null,
}));
vi.mock("../facturacionColumns", () => ({ buildFacturaColumns: () => [] }));
vi.mock(
  "@/features/facturacion/components/bandejas/FacturacionBandejasTabs",
  () => ({
    FacturacionBandejasTabs: ({
      setActiveBandeja,
    }: {
      setActiveBandeja: (id: string) => void;
    }) => (
      <button onClick={() => setActiveBandeja("vencidas")}>
        Abrir vencidas
      </button>
    ),
  }),
);
function CurrentUrl() {
  const location = useLocation();
  return <output data-testid="url">{location.search}</output>;
}

describe("Facturacion bucket URL pagination", () => {
  it("resets page on bucket selection and preserves search, currency and page size", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/facturacion?bandeja=por-cobrar&page=1&ps=20&q=cliente&moneda=EUR",
        ]}
      >
        <Facturacion />
        <CurrentUrl />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Abrir vencidas" }));
    await waitFor(() =>
      expect(screen.getByTestId("url")).toHaveTextContent("bandeja=vencidas"),
    );
    const params = new URLSearchParams(
      screen.getByTestId("url").textContent ?? "",
    );
    expect(params.has("page")).toBe(false);
    expect(params.get("ps")).toBe("20");
    expect(params.get("q")).toBe("cliente");
    expect(params.get("moneda")).toBe("EUR");
  });
});
