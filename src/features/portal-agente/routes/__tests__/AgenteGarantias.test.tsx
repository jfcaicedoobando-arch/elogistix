import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import AgenteGarantias from "../AgenteGarantias";

const viewport = vi.hoisted(() => ({ mobile: true }));
vi.mock("@/hooks/shared", () => ({
  useDocumentTitle: vi.fn(), useIsMobile: () => viewport.mobile,
}));
vi.mock("@/features/costeo/hooks/useNavieraCondiciones", () => ({
  useNavierasCatalogo: () => ({ data: [{ id: "n1", name: "CMA CGM", code: "CMDU" }] }),
  useCondicionesNaviera: () => ({ data: [] }),
  useProveedoresNaviera: () => ({ data: [] }),
}));
vi.mock("@/features/portal-agente/hooks", () => ({ useAgenteTarifas: () => ({ data: [] }) }));

describe("Garantías del agente — acciones sin botones anidados", () => {
  beforeEach(() => { viewport.mobile = true; });

  it("ofrece un solo botón por tarjeta móvil y abre el requisito", () => {
    const { container } = render(<MemoryRouter><AgenteGarantias /></MemoryRouter>);
    expect(container.querySelector("button button")).toBeNull();
    expect(screen.getAllByRole("button", { name: /Ver requisito/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Ver requisito" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("CMA CGM · CMDU");
    fireEvent.click(screen.getByRole("button", { name: "Entendido" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("mantiene la apertura por fila en escritorio", () => {
    viewport.mobile = false;
    render(<MemoryRouter><AgenteGarantias /></MemoryRouter>);
    fireEvent.click(screen.getByText("CMA CGM", { exact: true }));
    expect(screen.getByRole("dialog")).toHaveTextContent("CMA CGM · CMDU");
  });
});
