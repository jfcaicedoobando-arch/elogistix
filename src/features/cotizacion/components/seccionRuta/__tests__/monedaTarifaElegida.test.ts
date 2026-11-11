import { describe, expect, it, vi } from "vitest";
vi.mock("@/features/costeo/services/topTarifas", () => ({ fetchRecargosDeTarifa: vi.fn() }));
vi.mock("@/features/costeo", () => ({ etiquetaPuertoCompleta: vi.fn(), origenDe: vi.fn(), destinoDe: vi.fn() }));
import { aplicarTarifaAlForm } from "@/features/cotizacion/hooks/wizard/aplicarTarifaAlForm";
import { requiereTipoCambioCotizacion } from "@/features/cotizacion/domain/mezclaMonedas";
import { buildVentaCotizacionPayload } from "@/features/cotizacion/services/ventaPayload";
import type { TopTarifaRow } from "@/features/costeo/types";

describe("moneda de la opción elegida", () => {
  it.each(["USD", "MXN"])("seleccionar %s conserva la moneda CRM y captura la tarifa", moneda => {
    const setValue = vi.fn();
    aplicarTarifaAlForm(setValue, vi.fn(), { id: "tarifa", moneda } as TopTarifaRow);
    expect(setValue).toHaveBeenCalledWith("monedaTarifa", moneda, { shouldDirty: true, shouldValidate: true });
    expect(setValue.mock.calls.some(([campo]) => campo === "monedaCrm")).toBe(false);
  });
  it("tarifa USD 6,300 no pide TC aunque la oportunidad esté en MXN", () => {
    expect(requiereTipoCambioCotizacion([{ total: 6300 }], [], "MXN", "USD")).toBe(false);
    expect(buildVentaCotizacionPayload({ conceptosVenta: [{ moneda: "USD", cantidad: 1, precio_unitario: 6300 }], monedaFallback: "MXN", conservarMoneda: true, monedaTarifa: "USD", tipoCambioUsd: null }))
      .toMatchObject({ moneda: "USD", subtotal: 6300, tipo_cambio_usd: null });
  });
  it("tarifa MXN pide TC aunque todos los conceptos estén en pesos", () => {
    expect(requiereTipoCambioCotizacion([], [{ total: 6300 }], "USD", "MXN")).toBe(true);
    const input = { conceptosVenta: [{ moneda: "MXN", cantidad: 1, precio_unitario: 6300 }], monedaFallback: "USD", monedaTarifa: "MXN" };
    expect(() => buildVentaCotizacionPayload({ ...input, tipoCambioUsd: null })).toThrow(/tipo de cambio/i);
    expect(buildVentaCotizacionPayload({ ...input, tipoCambioUsd: 18.7147 })).toMatchObject({ moneda: "MXN", subtotal: 6300, tipo_cambio_usd: 18.7147 });
  });
  it("USD con conceptos en pesos mantiene el candado de conversión", () => {
    expect(() => buildVentaCotizacionPayload({ conceptosVenta: [{ moneda: "USD", total: 6300 }, { moneda: "MXN", total: 100 }], monedaTarifa: "USD", tipoCambioUsd: null })).toThrow(/tipo de cambio/i);
  });
});
