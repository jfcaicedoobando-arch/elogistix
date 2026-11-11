import { describe, it, expect } from "vitest";
import { buildVentaCotizacionPayload } from "../ventaPayload";
import { monedaObjetivoCotizacion, requiereTipoCambioCotizacion } from "../../domain/mezclaMonedas";

const usd = [{ descripcion: "Flete", moneda: "USD", cantidad: 1, precio_unitario: 100, subtotal: 100, total: 100 }];

describe("Pricing MXN con tarifa USD (COT-2026-0337)", () => {
  it("conserva MXN del vínculo y convierte con TC", () => {
    const d = buildVentaCotizacionPayload({ conceptosVenta: usd, monedaFallback: "MXN", monedaTarifa: "USD", conservarMoneda: true, tipoCambioUsd: 18 });
    expect(d.moneda).toBe("MXN");
    expect(d.subtotal).toBe(1800);
  });
  it("exige TC en el paso 3", () => {
    const canonica = monedaObjetivoCotizacion("t", "USD", "s", "MXN");
    expect(canonica).toBe("MXN");
    expect(requiereTipoCambioCotizacion(usd, [], canonica, null)).toBe(true);
  });
  it("sin Pricing, tarifa USD queda en USD sin TC", () => {
    const d = buildVentaCotizacionPayload({ conceptosVenta: usd, monedaFallback: "MXN", monedaTarifa: "USD" });
    expect(d.moneda).toBe("USD");
    expect(requiereTipoCambioCotizacion(usd, [], monedaObjetivoCotizacion("t", "USD", null, "MXN"), "USD")).toBe(false);
  });
});
