import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
const registrar = vi.hoisted(() => vi.fn());
vi.mock("@/features/tesoreria/hooks/useTraspasos", () => ({ useRegistrarTraspaso: () => ({ mutate: registrar, isPending: false }) }));
vi.mock("@/features/tesoreria/hooks/useTraspasoForm", () => ({
  useTraspasoForm: () => ({
    state: { origenId: "a", destinoId: "b", fecha: "2026-09-30", montoOrigen: 100, comision: 0, concepto: "", referencia: "" },
    setField: vi.fn(), mismoMoneda: true, factorOrigenDestino: 1, montoDestino: 100,
    error: null, fechaInicial: "2026-09-30", tcEsManual: false,
  }),
  traspasoSucio: () => false, partesTraspaso: () => ({}), conceptoTraspaso: () => "Traspaso",
}));
vi.mock("@/components/shared/FormDialogShell", () => ({
  FormDialogShell: ({ children, footer, onSubmit }: { children: ReactNode; footer: ReactNode; onSubmit: React.FormEventHandler }) =>
    <form onSubmit={onSubmit}>{children}{footer}<button type="submit">Intentar submit</button></form>,
}));
vi.mock("@/components/shared/FormDialogFooter", () => ({
  FormDialogFooter: ({ disabled }: { disabled: boolean }) => <button type="submit" disabled={disabled}>Registrar traspaso</button>,
}));
vi.mock("../TraspasoImportes", () => ({ TraspasoImportes: () => null }));
vi.mock("../TraspasoCuentaSelect", () => ({ TraspasoCuentaSelect: () => null }));
import { DialogTraspasoCuentas } from "../DialogTraspasoCuentas";
describe("N03 · candado del modal", () => {
  it("no llama la mutación con menos de dos cuentas aunque el formulario esté válido", () => {
    render(<DialogTraspasoCuentas open onOpenChange={vi.fn()} cuentas={[]} />);
    expect(screen.getByRole("button", { name: "Registrar traspaso" })).toBeDisabled();
    expect(screen.getByText(/Se necesitan al menos dos cuentas/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Intentar submit" }));
    expect(registrar).not.toHaveBeenCalled();
  });
});
