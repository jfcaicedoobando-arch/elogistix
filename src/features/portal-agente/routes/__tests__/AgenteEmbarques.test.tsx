import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AgenteEmbarques from "@/features/portal-agente/routes/AgenteEmbarques";

vi.mock("@/features/portal-agente/hooks", () => ({
  useAgenteEmbarques: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
}));

describe("AgenteEmbarques — empty state", () => {
  it("explica que Operaciones asigna embarques al vincular la cotización/operación", () => {
    render(<AgenteEmbarques />);
    expect(
      screen.getByText(/Operaciones asigna embarques al agente cuando la cotización u operación lo vincula/i),
    ).toBeInTheDocument();
  });

  it("no ofrece un CTA a otros módulos", () => {
    render(<AgenteEmbarques />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ir a|crear|nuevo/i })).not.toBeInTheDocument();
  });
});
