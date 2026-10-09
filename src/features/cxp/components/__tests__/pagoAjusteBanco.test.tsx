import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import * as controllerModule from "@/features/cxp/hooks/useConciliacionPagoCellController";
import { PagoFila, type PagoRow } from "../DialogDetallePagosProveedor.fila";
const { sugerir, vincular, desvincular } = vi.hoisted(() => ({ sugerir: vi.fn(), vincular: vi.fn(), desvincular: vi.fn() }));
vi.mock("@/features/cxp/services/conciliacionBancaria", () => ({ sugerirMovsParaPagoProveedor: sugerir }));
vi.mock("@/features/tesoreria/services/conciliacion", () => ({ conciliarConPago: vincular, desconciliarMovimiento: desvincular }));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u" } }) }));
vi.mock("@/components/shared/Hint", () => ({ Hint: ({ children }: { children: ReactNode }) => <>{children}</> }));
const controller = vi.spyOn(controllerModule, "useConciliacionPagoCellController");
const pago = (over: Partial<PagoRow> = {}): PagoRow => ({ id: "ajuste", fecha_pago: "2026-10-07", metodo_pago: "Otro", monto: 1, moneda: "MXN", es_ajuste: true, bbva_movimientos: [], ...over });
function fila(p: PagoRow) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><table><tbody><PagoFila pago={p} canEdit onEliminar={vi.fn()} onEditar={vi.fn()} /></tbody></table></QueryClientProvider>);
}
beforeEach(() => { vi.clearAllMocks(); sugerir.mockResolvedValue([]); vincular.mockResolvedValue(undefined); });
describe("PagoFila real: ajustes fuera de la conciliación bancaria", () => {
  it("abrir, cerrar y reabrir nunca monta consultas ni ofrece vincular", () => {
    const first = fila(pago());
    expect(screen.getByText("No aplica")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Vincular banco|Desvincular movimiento/ })).not.toBeInTheDocument();
    first.unmount(); fila(pago());
    expect(screen.getByText(/Ajuste no monetario/)).toBeInTheDocument();
    expect(sugerir).not.toHaveBeenCalled(); expect(vincular).not.toHaveBeenCalled(); expect(desvincular).not.toHaveBeenCalled();
    expect(controller).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Editar pago" })).not.toBeInTheDocument();
  });
  it("expone vínculo histórico inconsistente sin mostrarlo como conciliación válida", () => {
    fila(pago({ bbva_movimientos: [{ id: "historico", fecha: "2026-10-07", concepto: null, referencia: null, cargo: 1, abono: 0, estado_conciliacion: "Conciliado" }] }));
    expect(screen.getByText(/Vínculo bancario por revisar/)).toBeInTheDocument();
    expect(screen.queryByText("Conciliado")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Vincular banco|Desvincular movimiento/ })).not.toBeInTheDocument();
    expect(sugerir).not.toHaveBeenCalled(); expect(desvincular).not.toHaveBeenCalled();
    expect(controller).not.toHaveBeenCalled();
  });
  it("flag false con texto Ajuste conserva consulta y vínculo ordinarios", async () => {
    sugerir.mockResolvedValue([{ id: "mov", fecha: "2026-10-07", cargo: 1, delta_monto: 0, delta_dias: 0 }]);
    fila(pago({ es_ajuste: false, referencia: "Ajuste", metodo_pago: "Ajuste" }));
    fireEvent.click(screen.getByRole("button", { name: "Vincular banco" }));
    fireEvent.click(await screen.findByRole("button", { name: "Vincular" }));
    await waitFor(() => expect(vincular).toHaveBeenCalledWith("mov", "cxp", "ajuste", "u"));
    expect(sugerir).toHaveBeenCalled();
  });
});
