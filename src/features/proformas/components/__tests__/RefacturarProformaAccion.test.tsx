import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ mutate: vi.fn(), factura: "F1", pending: false }));
vi.mock("../../hooks/useRefacturarProforma", () => ({
  useFacturaCanceladaDeProforma: () => ({ data: mocks.factura }),
  useRefacturarProforma: () => ({ mutate: mocks.mutate, isPending: mocks.pending }),
}));
import { RefacturarProformaAccion } from "../RefacturarProformaAccion";
beforeEach(() => { vi.clearAllMocks(); mocks.pending = false; });
describe("confirmación refacturación", () => {
  it("cancelar y volver a abrir no llama RPC; confirmar llama sólo al aceptar", () => {
    render(<RefacturarProformaAccion proformaId="p1" numero="P1" habilitada />);
    fireEvent.click(screen.getByRole("button", { name: /Refacturar desde/ }));
    expect(screen.getByText(/seguirá cancelada/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(mocks.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Refacturar desde/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar a la proforma nueva" }));
    expect(mocks.mutate).toHaveBeenCalledOnce();
  });
  it("mantiene bloqueado confirmar y cancelar mientras procesa", () => {
    mocks.pending = true;
    render(<RefacturarProformaAccion proformaId="p1" numero="P1" habilitada />);
    fireEvent.click(screen.getByRole("button", { name: /Refacturar desde/ }));
    expect(screen.getByRole("button", { name: "Preparando…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });
  it("no ofrece refacturación si el guard del detalle la prohíbe", () => {
    render(<RefacturarProformaAccion proformaId="p1" numero="P1" habilitada={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
