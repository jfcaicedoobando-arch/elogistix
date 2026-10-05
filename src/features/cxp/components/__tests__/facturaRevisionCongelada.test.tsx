import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { FacturaCxP } from "@/features/cxp/services";
import type { useAprobarFactura } from "@/features/cxp/hooks/useAprobarFactura";

const mock = vi.hoisted(() => ({ version: "v1", descripcion: "Revisada", guardar: vi.fn() }));
vi.mock("@/features/cxp/hooks/useConceptosFacturaSnapshot", () => ({
  useConceptosFacturaSnapshot: () => ({ data: { factura: {
    subtotal: 100, iva: 0, ieps: 0, retenciones: 0, total: 100, updated_at: mock.version,
  }, conceptos: [{ id: "c1", descripcion: mock.descripcion, cantidad: 1, monto: 100, iva: 0, ieps: 0 }] }, isLoading: false, isError: false }),
}));
vi.mock("@/features/cxp/hooks/useEditarConceptosFactura", () => ({ useEditarConceptosFactura: () => ({ mutateAsync: mock.guardar, isPending: false }) }));
import { DialogEditarConceptosFactura } from "../DialogEditarConceptosFactura";
import { AprobarRechazarDialogs } from "../DialogDetallePagosProveedor.aprobardialogs";

describe("factura revisada al abrir el modal", () => {
  beforeEach(() => { mock.version = "v1"; mock.descripcion = "Revisada"; mock.guardar.mockReset(); });
  it("editar conceptos conserva el formulario y la versión inicial tras refetch; el conflicto mantiene abierto el modal", async () => {
    const cerrar = vi.fn();
    const component = <TooltipProvider><DialogEditarConceptosFactura open onOpenChange={cerrar}
      facturaId="f1" folio="FP14" moneda="MXN" subtotal={100} /></TooltipProvider>;
    const view = render(component);
    expect(screen.getByLabelText("Descripción del concepto")).toHaveValue("Revisada");
    mock.version = "v2"; mock.descripcion = "Cambio de otra pestaña";
    view.rerender(<TooltipProvider><DialogEditarConceptosFactura open onOpenChange={cerrar}
      facturaId="f1" folio="FP14" moneda="MXN" subtotal={100} /></TooltipProvider>);
    expect(screen.getByLabelText("Descripción del concepto")).toHaveValue("Revisada");
    mock.guardar.mockRejectedValue(new Error("LC_CONFLICTO_CONCURRENCIA"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar conceptos" }));
    await waitFor(() => expect(mock.guardar).toHaveBeenCalledWith(expect.objectContaining({ expectedUpdatedAt: "v1" })));
    expect(cerrar).not.toHaveBeenCalled();
  });
  it("aprobar conserva la versión mostrada aunque el detalle se refresque antes de confirmar", async () => {
    const cerrar = vi.fn();
    const confirmar = vi.fn().mockRejectedValue(new Error("LC_CONFLICTO_CONCURRENCIA"));
    const aprobar = { mutateAsync: confirmar, isPending: false } as unknown as ReturnType<typeof useAprobarFactura>;
    const factura = { id: "f1", embarque_id: "e1", updated_at: "v1", folio_interno: "FP14", proveedor_nombre: "Maniobras" } as FacturaCxP;
    const props = { openAprobar: true, openRechazar: false, setOpenAprobar: cerrar, setOpenRechazar: vi.fn(), aprobar, ctxLabel: "FP14" };
    const view = render(<AprobarRechazarDialogs {...props} f={factura} />);
    view.rerender(<AprobarRechazarDialogs {...props} f={{ ...factura, updated_at: "v2", tipo_cambio_usd: 21 }} />);
    fireEvent.click(screen.getByRole("button", { name: "Sí, aprobar" }));
    await waitFor(() => expect(confirmar).toHaveBeenCalledWith(expect.objectContaining({ expectedUpdatedAt: "v1" })));
    expect(cerrar).not.toHaveBeenCalled();
  });
});
