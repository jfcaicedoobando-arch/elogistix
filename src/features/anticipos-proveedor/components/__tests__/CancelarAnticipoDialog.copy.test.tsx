import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CancelarAnticipoDialog } from "../CancelarAnticipoDialog";
import type { AnticipoProveedorRow } from "../../hooks/useAnticiposProveedor";

const mutation = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
vi.mock("../../hooks/useAnticipoProveedorMutations", () => ({ useCancelarAnticipo: () => mutation }));
describe("Anulación de anticipo: registro bancario vs devolución real", () => {
  it("informa qué se anula y no envía ninguna mutación al abrir", () => {
    const anticipo = { id: "anticipo-mock", proveedor_nombre: "Transportes del Norte" } as AnticipoProveedorRow;
    render(<CancelarAnticipoDialog open anticipo={anticipo} onOpenChange={vi.fn()} />);
    expect(screen.getByText(/Se anulará también su movimiento bancario en el ERP/)).toBeInTheDocument();
    expect(screen.getByText(/no devuelve dinero en el banco/)).toBeInTheDocument();
    expect(screen.getByText(/Registrar devolución/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anular registro" })).toBeInTheDocument();
    expect(mutation.mutateAsync).not.toHaveBeenCalled();
  });
});
