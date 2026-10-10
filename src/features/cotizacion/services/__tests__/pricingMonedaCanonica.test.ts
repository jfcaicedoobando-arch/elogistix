import { describe, expect, it, vi } from "vitest";
vi.mock("@/services/storage/index", () => ({ uploadFile: vi.fn() }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyWarning: vi.fn() }));
import { derivarSubtotalMoneda } from "../derivarSubtotalMoneda";
import { buildVentaCotizacionPayload } from "../ventaPayload";
import { savePaso3, savePasoFinal } from "../wizard";

const usd = { descripcion: "Flete marítimo", cantidad: 1, precio_unitario: 1.41, total: 1.41, moneda: "USD", origen_costo_id: "origen-A" };
const mxn = { descripcion: "Manual", cantidad: 1, precio_unitario: 100, total: 116, moneda: "MXN", tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16 };
const input = { conceptosVenta: [usd], monedaFallback: "MXN", tipoCambioUsd: 20, conservarMoneda: true };

describe("venta Pricing conserva moneda canónica", () => {
  it("USD-only conserva MXN y convierte sólo subtotal sin tocar concepto ni linaje", () => {
    const payload = buildVentaCotizacionPayload(input);
    expect(payload).toEqual({ conceptos_venta: [usd], moneda: "MXN", subtotal: 28.2, tipo_cambio_usd: 20 });
    expect(payload.conceptos_venta).toBe(input.conceptosVenta);
    expect(Object.keys(payload).sort()).toEqual(["conceptos_venta", "moneda", "subtotal", "tipo_cambio_usd"]);
  });
  it("MXN-only conserva USD y divide subtotal sin IVA", () => {
    expect(derivarSubtotalMoneda([mxn], "USD", 20, true)).toEqual({ moneda: "USD", subtotal: 5 });
  });
  it.each([null, undefined, 0, -1, NaN, Infinity, -Infinity])("TC inválido %s falla antes de mutar", async (tipoCambioUsd) => {
    const mutateAsync = vi.fn();
    await expect(savePaso3({ ...input, tipoCambioUsd, cotizacionId: "cot-A", mutations: { updateCotizacion: { mutateAsync } } })).rejects.toThrow(/tipo de cambio.*paso 3/i);
    expect(mutateAsync).not.toHaveBeenCalled();
  });
  it.each(["", null, undefined, "EUR"])("moneda canónica ausente/ inválida %s no se infiere desde ventas", (monedaFallback) => {
    expect(() => buildVentaCotizacionPayload({ ...input, monedaFallback })).toThrow(/moneda.*Pricing/i);
  });
  it.each(["USD", "MXN"])("misma moneda %s no requiere TC", (moneda) => {
    expect(derivarSubtotalMoneda([{ ...usd, moneda }], moneda, null, true)).toEqual({ moneda, subtotal: 1.41 });
  });
  it("misma moneda normaliza TC no finito sin enviarlo al servidor", () => {
    expect(buildVentaCotizacionPayload({ ...input, monedaFallback: "USD", tipoCambioUsd: Infinity })).toMatchObject({ moneda: "USD", subtotal: 1.41, tipo_cambio_usd: null });
  });
  it("sin importes mantiene canónica sin inventar TC", () => {
    expect(derivarSubtotalMoneda([], "MXN", null, true)).toEqual({ moneda: "MXN", subtotal: 0 });
  });
  it("mixta convierte ambas bolsas al objetivo sin IVA", () => {
    expect(derivarSubtotalMoneda([usd, mxn], "MXN", 20, true)).toEqual({ moneda: "MXN", subtotal: 128.2 });
    expect(derivarSubtotalMoneda([usd, mxn], "USD", 20, true)).toEqual({ moneda: "USD", subtotal: 6.41 });
  });
  it("redondea decimal igual a ROUND(numeric,2) del servidor", () => {
    expect(derivarSubtotalMoneda([{ ...usd, precio_unitario: 0.15, total: 0.15 }], "MXN", 16.7, true)).toEqual({ moneda: "MXN", subtotal: 2.51 });
  });
  it("sin Pricing conserva el contrato previo de única bolsa, aun con fallback opuesto", () => {
    expect(buildVentaCotizacionPayload({ ...input, conservarMoneda: false, tipoCambioUsd: null })).toMatchObject({ moneda: "USD", subtotal: 1.41 });
  });
  it("paso 3 y final guardan exactamente el mismo importe y moneda", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    const mutations = { updateCotizacion: { mutateAsync } };
    await savePaso3({ ...input, cotizacionId: "cot-A", mutations });
    await savePasoFinal({ cotizacionId: "cot-A", isEditMode: true, venta: input, mutations, registrarActividad: vi.fn() });
    expect(mutateAsync).toHaveBeenCalledTimes(2);
    expect(mutateAsync.mock.calls[0]).toEqual(mutateAsync.mock.calls[1]);
    expect(mutateAsync).toHaveBeenCalledWith({ id: "cot-A", data: { conceptos_venta: [usd], moneda: "MXN", subtotal: 28.2, tipo_cambio_usd: 20 } });
  });
  it("finalización sin TC no persiste ni registra actividad de éxito", async () => {
    const mutateAsync = vi.fn(); const registrarActividad = vi.fn();
    await expect(savePasoFinal({ cotizacionId: "cot-A", isEditMode: false, venta: { ...input, tipoCambioUsd: null }, mutations: { updateCotizacion: { mutateAsync } }, registrarActividad })).rejects.toThrow(/tipo de cambio/);
    expect(mutateAsync).not.toHaveBeenCalled(); expect(registrarActividad).not.toHaveBeenCalled();
  });
});
