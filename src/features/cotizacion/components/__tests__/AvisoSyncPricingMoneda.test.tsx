import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CostoCotizacion } from "@/features/cotizacion/types";
const m = vi.hoisted(() => ({ update: vi.fn(), sello: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock("@/features/cotizacion/hooks", () => ({ useUpdateCotizacion: () => ({ mutateAsync: m.update, isPending: false }) }));
vi.mock("@/features/cotizacion/services/updatedAt", () => ({ fetchCotizacionSelloSync: m.sello }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: m.error, notifySuccess: m.success }));
import { AvisoSincronizarConceptosVenta } from "../AvisoSincronizarConceptosVenta";
const costos: CostoCotizacion[] = [{ id: "cost-A", cotizacion_id: "quote-A", concepto: "Flete marítimo", cantidad: 1, costo_unitario: 1.23, costo_total: 1.23, precio_venta: 1.41, moneda: "USD", proveedor: "Proveedor", unidad_medida: "Contenedor", notas: "", origen_venta_id: "origin-A", costeo_tarifa_id: "tariff-A", costeo_tarifa_recargo_id: null, created_at: "", updated_at: "" }];
function montar() {
  render(<AvisoSincronizarConceptosVenta cotizacionId="quote-A" costos={costos} tasaIva={0.16} visible puedeSincronizar estadoCotizacion="Borrador" />);
  fireEvent.click(screen.getByRole("button", { name: /Sincronizar conceptos/ }));
}
beforeEach(() => { vi.clearAllMocks(); m.update.mockResolvedValue(undefined); });
describe("sincronización Pricing preserva moneda y sello", () => {
  it("moneda persistida MXN y USD-only necesitan TC; no manda update con importe nominal", async () => {
    m.sello.mockResolvedValue({ updatedAt: "stamp-A", moneda: "MXN", tipoCambioUsd: null, pricingSolicitudId: "request-A" });
    montar(); await waitFor(() => expect(m.error).toHaveBeenCalled());
    expect(m.update).not.toHaveBeenCalled(); expect(m.success).not.toHaveBeenCalled();
    expect(m.error).toHaveBeenCalledWith(undefined, expect.objectContaining({ description: expect.stringMatching(/tipo de cambio.*paso 3/) }));
  });
  it("TC congelado convierte sólo subtotal y mantiene identidad costo/venta y candado", async () => {
    m.sello.mockResolvedValue({ updatedAt: "stamp-A", moneda: "MXN", tipoCambioUsd: 20, pricingSolicitudId: "request-A" });
    montar(); await waitFor(() => expect(m.update).toHaveBeenCalled());
    expect(m.update).toHaveBeenCalledWith({ id: "quote-A", expectedUpdatedAt: "stamp-A", data: { moneda: "MXN", subtotal: 28.2, conceptos_venta: [expect.objectContaining({ moneda: "USD", precio_unitario: 1.41, origen_costo_id: "origin-A" })] } });
    expect(m.success).toHaveBeenCalledTimes(1);
  });
  it("falla del guard optimista no muestra éxito ni reintenta otro registro", async () => {
    m.sello.mockResolvedValue({ updatedAt: "stamp-A", moneda: "MXN", tipoCambioUsd: 20, pricingSolicitudId: "request-A" });
    m.update.mockRejectedValueOnce(new Error("LC_CONFLICTO_CONCURRENCIA"));
    montar(); await waitFor(() => expect(m.error).toHaveBeenCalled());
    expect(m.update).toHaveBeenCalledTimes(1); expect(m.success).not.toHaveBeenCalled();
  });
});
