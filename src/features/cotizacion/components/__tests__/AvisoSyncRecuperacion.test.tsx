import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CostoCotizacion } from "@/features/cotizacion/types";
import type { EstadoCotizacion } from "@/features/cotizacion/services/mutations/estado";
const m = vi.hoisted(() => ({ update: vi.fn(), sello: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock("@/features/cotizacion/hooks", () => ({ useUpdateCotizacion: () => ({ mutateAsync: m.update, isPending: false }) }));
vi.mock("@/features/cotizacion/services/updatedAt", () => ({ fetchCotizacionSelloSync: m.sello }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: m.error, notifySuccess: m.success }));
import { AvisoSincronizarConceptosVenta } from "../AvisoSincronizarConceptosVenta";
const costos: CostoCotizacion[] = [{ id: "cost-row-replaced", cotizacion_id: "quote-A", concepto: "Flete marítimo", cantidad: 1, costo_unitario: 1.23, costo_total: 1.23, precio_venta: 1.41, moneda: "USD", proveedor: "Proveedor", unidad_medida: "Contenedor", notas: "", origen_venta_id: "stable-origin", costeo_tarifa_id: "tariff-A", costeo_tarifa_recargo_id: null, created_at: "", updated_at: "" }];
function montar(puedeSincronizar = true, estadoCotizacion: EstadoCotizacion = "Borrador") {
  render(<AvisoSincronizarConceptosVenta cotizacionId="quote-A" costos={costos} tasaIva={0.16} visible puedeSincronizar={puedeSincronizar} estadoCotizacion={estadoCotizacion} />);
}
beforeEach(() => { vi.clearAllMocks(); m.sello.mockResolvedValue({ updatedAt: "stamp-A", moneda: "MXN", tipoCambioUsd: null, pricingSolicitudId: "request-A" }); });
describe("ruta de recuperación desde ficha", () => {
  it("ofrece enlace exacto al wizard y explica la decisión local antes de guardar", () => {
    montar();
    expect(screen.getByRole("link", { name: "Editar cotización y revisar conceptos" })).toHaveAttribute("href", "/cotizaciones/quote-A/editar");
    expect(screen.getByText(/ve a Cliente y elige «Preparar conceptos desde costos»/)).toBeInTheDocument();
    expect(m.update).not.toHaveBeenCalled(); expect(m.sello).not.toHaveBeenCalled();
  });
  it("sync sin TC conserva fallo cerrado y deja ruta visible, sin abrir supuesto diálogo ni escribir", async () => {
    montar(); fireEvent.click(screen.getByRole("button", { name: /Sincronizar conceptos/ }));
    await waitFor(() => expect(m.error).toHaveBeenCalled());
    expect(m.update).not.toHaveBeenCalled(); expect(m.success).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Editar cotización y revisar conceptos" })).toHaveAttribute("href", "/cotizaciones/quote-A/editar");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it.each([false, true])("sin escritura o estado inmutable no ofrece enlaces de edición (%s)", (sinPermiso) => {
    montar(!sinPermiso, sinPermiso ? "Borrador" : "Aceptada");
    expect(screen.queryByRole("link")).not.toBeInTheDocument(); expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
