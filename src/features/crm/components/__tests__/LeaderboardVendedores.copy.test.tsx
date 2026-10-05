import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LeaderboardVendedores from "../LeaderboardVendedores";

const state = vi.hoisted(() => ({ rows: [{ vendedor: "ventas@norte.test", moneda: "USD", cerrado: 500, cuota: 0, avance: 0 }] }));
vi.mock("@/features/crm/hooks", () => ({ useLeaderboardVendedores: () => ({ data: state.rows, isLoading: false, isError: false, refetch: vi.fn() }) }));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ user: { email: "admin@norte.test" } }) }));
describe("Desempeño sin meta", () => {
  it("no representa la ausencia de cuota como incumplimiento al 0%", () => {
    render(<LeaderboardVendedores />);
    expect(screen.getByText("Sin meta configurada")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
    expect(screen.getByText("Desempeño de vendedores del mes")).toBeInTheDocument();
  });
});
