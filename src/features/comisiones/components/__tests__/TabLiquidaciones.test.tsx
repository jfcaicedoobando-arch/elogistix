/**
 * Ola 4 · N28: gating de botones por rol en /comisiones — mismos roles que
 * la RPC/RLS de liquidaciones (admins + contador/tesorero). Gerentes ven la
 * tabla pero sin botones de gestión.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";
import { TabLiquidaciones } from "../TabLiquidaciones";

const { mockUseAuth, mockUseLiquidaciones } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseLiquidaciones: vi.fn(),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: mockUseAuth }));
vi.mock("@/features/comisiones/hooks", () => ({ useLiquidaciones: mockUseLiquidaciones }));

const LIQ_ROW = {
  id: "l1",
  vendedora_id: "v1",
  periodo: "2024-01",
  total_mxn: 100,
  fecha_pago: null,
  referencia: null,
};

function renderTab(effectiveRole: string | null) {
  mockUseAuth.mockReturnValue({ effectiveRole });
  mockUseLiquidaciones.mockReturnValue({ data: [LIQ_ROW], isLoading: false });
  return render(<TabLiquidaciones vendedoras={[]} />, { wrapper: createWrapper() });
}

describe("TabLiquidaciones — gating por rol (Ola 4 · N28)", () => {
  it("contador ve el botón Generar liquidación y Registrar pago", () => {
    renderTab("contador");
    expect(screen.getByText(/Generar liquidación/i)).toBeInTheDocument();
    expect(screen.getByText(/Registrar pago/i)).toBeInTheDocument();
  });

  it("tesorero ve los botones de gestión", () => {
    renderTab("tesorero");
    expect(screen.getByText(/Generar liquidación/i)).toBeInTheDocument();
    expect(screen.getByText(/Registrar pago/i)).toBeInTheDocument();
  });

  it("gerente_visor ve la tabla sin botones de gestión", () => {
    renderTab("gerente_visor");
    expect(screen.queryByText(/Generar liquidación/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Registrar pago/i)).not.toBeInTheDocument();
    expect(screen.getByText("2024-01")).toBeInTheDocument();
  });

  it("gerente_comercial y gerente_operaciones tampoco ven botones", () => {
    renderTab("gerente_comercial");
    expect(screen.queryByText(/Generar liquidación/i)).not.toBeInTheDocument();
  });

  it("admin ve los botones de gestión", () => {
    renderTab("admin");
    expect(screen.getByText(/Generar liquidación/i)).toBeInTheDocument();
  });
});
