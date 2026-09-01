/**
 * Finanzas: si una fuente crítica falla no se pintan KPIs en 0 (cero
 * silencioso), sino una sola rama de error accesible con retry.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { createWrapper } from "@/test/utils/queryWrapper";

const { mockDash } = vi.hoisted(() => ({ mockDash: vi.fn() }));

vi.mock("@/features/dashboard/finance/hooks/useFinanceDashboard", () => ({
  useFinanceDashboard: mockDash,
}));
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "ana@x.com" }, effectiveRole: "admin" }),
}));

import { FinanceDashboard } from "../FinanceDashboard";

const OK = {
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
  cobranzaKpis: { vencido_mxn: 1000, vencido_usd: 50 },
  cxpKpis: { por_pagar_mxn: 500, por_pagar_usd: 20 },
  tesoreria: { cuentas: [] },
  ejecutivo: undefined,
  hueco: { total: 2, totalUsd: 0, totalMxn: 0 },
  pendientesAdmin: { entregadosCount: 1, eirCount: 0 },
  facturasVencidas: [],
  cxpPorPagar: [],
  aging: { buckets: [], total: 0 },
};

function renderDash() {
  const Wrapper = createWrapper();
  return render(
    <Wrapper>
      <MemoryRouter>
        <FinanceDashboard />
      </MemoryRouter>
    </Wrapper>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("FinanceDashboard — estados excluyentes", () => {
  it.each(["CxC", "CxP", "tesorería"])(
    "fuente crítica %s con error: error visible y ninguna tarjeta KPI en 0",
    (fuente) => {
      const retry = vi.fn();
      mockDash.mockReturnValue({
        ...OK,
        isError: true,
        error: new Error(`Falló ${fuente}`),
        refetch: retry,
        cobranzaKpis: undefined,
        cxpKpis: undefined,
        tesoreria: undefined,
      });
      renderDash();
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(`Falló ${fuente}`)).toBeInTheDocument();
      // Ninguna cifra en cero se presenta como dato real.
      expect(screen.queryByText("$0")).not.toBeInTheDocument();
      expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
    },
  );

  it("error: el retry reintenta las fuentes", async () => {
    const retry = vi.fn();
    mockDash.mockReturnValue({ ...OK, isError: true, error: new Error("boom"), refetch: retry });
    renderDash();
    screen.getByRole("button", { name: /reintentar/i }).click();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("sin error: renderiza el contenido y no la rama de error", () => {
    mockDash.mockReturnValue(OK);
    renderDash();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/no se pudieron cargar las cifras/i)).not.toBeInTheDocument();
  });
});
