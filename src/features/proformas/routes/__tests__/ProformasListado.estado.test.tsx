import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import ProformasListado from "../ProformasListado";

vi.mock("@/hooks/shared", () => ({ useDocumentTitle: vi.fn() }));
vi.mock("@/features/facturacion/components/TabProformas", () => ({
  TabProformas: ({ estadoInicial }: { estadoInicial: string }) => <div data-testid="estado-inicial">{estadoInicial}</div>,
}));

describe("filtro por URL del listado de proformas", () => {
  it.each(["cancelada", "aceptada", "pendiente", "rechazada", "facturada"])(
    "conserva el filtro %s al abrir el listado",
    (estado) => {
      render(<MemoryRouter initialEntries={[`/proformas?estado=${estado}`]}><ProformasListado /></MemoryRouter>);
      expect(screen.getByTestId("estado-inicial")).toHaveTextContent(estado);
      expect(screen.getByRole("heading", { name: estado === "aceptada" ? "Proformas por emitir" : "Proformas" })).toBeInTheDocument();
    },
  );

  it("usa todas ante un filtro desconocido", () => {
    render(<MemoryRouter initialEntries={["/proformas?estado=desconocido"]}><ProformasListado /></MemoryRouter>);
    expect(screen.getByTestId("estado-inicial")).toHaveTextContent("todas");
  });
});
