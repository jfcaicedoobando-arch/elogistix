import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockPermissions = vi.fn();
vi.mock("@/hooks/shared/usePermissions", () => ({
  usePermissions: () => mockPermissions(),
}));

import { ProfitTable } from "../ProfitTable";
import type { EmbarqueConProfit } from "@/features/dashboard/hooks";

const embarque = {
  id: "e1",
  expediente: "ELIMP00001",
  cliente_nombre: "Cliente Demo",
  ventaMXN: 10_000,
  costoMXN: 7_000,
  profitMXN: 3_000,
  margenMXN: 30,
  ventaMxnFromUsd: 0,
  costoMxnFromUsd: 0,
  ventaMxnFromEur: 0,
  costoMxnFromEur: 0,
  ventaMxnNative: 10_000,
  costoMxnNative: 7_000,
  tipoCambioUSD: 18,
  tipoCambioEUR: 20,
} as unknown as EmbarqueConProfit;

function renderTabla() {
  return render(
    <MemoryRouter>
      <ProfitTable embarques={[embarque]} isLoading={false} />
    </MemoryRouter>,
  );
}

describe("ProfitTable (QA B-07)", () => {
  it("muestra costo, utilidad y margen a quien puede ver costos", () => {
    mockPermissions.mockReturnValue({ canViewCosts: true });
    renderTabla();
    expect(screen.getByText("Costo MXN")).toBeInTheDocument();
    expect(screen.getByText("Utilidad MXN")).toBeInTheDocument();
    expect(screen.getByText("Margen")).toBeInTheDocument();
  });

  it("modo solo ventas: oculta costo, utilidad y margen a roles comerciales", () => {
    mockPermissions.mockReturnValue({ canViewCosts: false });
    renderTabla();
    expect(screen.getByText("Venta MXN")).toBeInTheDocument();
    expect(screen.queryByText("Costo MXN")).not.toBeInTheDocument();
    expect(screen.queryByText("Utilidad MXN")).not.toBeInTheDocument();
    expect(screen.queryByText("Margen")).not.toBeInTheDocument();
  });
});
