import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ eliminar: vi.fn(), registrar: vi.fn(), cancelar: vi.fn(), onEliminar: null as null | ((id: string) => void), onCancelar: null as null | ((p: object) => void), confirmarEliminar: null as null | (() => Promise<void>), confirmarCancelar: null as null | (() => Promise<void>) }));
vi.mock("@/features/facturacion/hooks", () => ({ usePagosFactura: () => ({ data: [{ id: "p1", monto: 50, monto_aplicado_factura: 50, estado_rep: "NoAplica" }], isLoading: false }), useEliminarPagoFactura: () => ({ mutateAsync: mocks.eliminar }) }));
vi.mock("@/features/facturacion/hooks/useSaldoFactura", () => ({ useNotasCreditoAplicadas: () => ({ data: [] }), useSaldoFacturaServidor: () => ({ data: 50 }) }));
vi.mock("@/hooks/shared", () => ({ useRegistrarActividad: () => ({ mutate: mocks.registrar }) }));
vi.mock("@/features/facturacion/hooks/useCancelarRepController", () => ({ useCancelarRepController: () => ({ confirmar: mocks.cancelar }) }));
vi.mock("../FacturaPagosTabla", () => ({ FacturaPagosTabla: ({ onEliminar, onCancelarRep }: { onEliminar: (id: string) => void; onCancelarRep: (p: object) => void }) => { mocks.onEliminar = onEliminar; mocks.onCancelar = onCancelarRep; return <p>Pagos históricos</p>; } }));
vi.mock("@/components/shared/dialogs/ConfirmActionDialog", () => ({ ConfirmActionDialog: ({ onConfirm }: { onConfirm: () => Promise<void> }) => { mocks.confirmarEliminar = onConfirm; return null; } }));
vi.mock("../../DialogCancelarRep", () => ({ DialogCancelarRep: ({ onConfirm }: { onConfirm: () => Promise<void> }) => { mocks.confirmarCancelar = onConfirm; return null; } }));
vi.mock("../../DialogPreviewCfdiPdf", () => ({ DialogPreviewCfdiPdf: () => null }));
import { FacturaPagosSection } from "../FacturaPagosSection";

const props = { facturaId: "f1", facturaNumero: "F-1", totalFactura: 100, moneda: "MXN", estadoFactura: "Emitida", canEdit: true };
describe("pagos: confirmar un modal tras perder elegibilidad", () => {
  beforeEach(() => vi.clearAllMocks());
  it("rechaza eliminación y cancelación aunque la selección local siga abierta", async () => {
    const { rerender } = render(<FacturaPagosSection {...props} />);
    act(() => { mocks.onEliminar?.("p1"); mocks.onCancelar?.({ id: "p1" }); });
    rerender(<FacturaPagosSection {...props} canEdit={false} soloLectura />);
    await act(async () => { await mocks.confirmarEliminar?.(); await mocks.confirmarCancelar?.(); });
    expect(mocks.eliminar).not.toHaveBeenCalled();
    expect(mocks.cancelar).not.toHaveBeenCalled();
    expect(mocks.registrar).not.toHaveBeenCalled();
  });
});
