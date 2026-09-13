/**
 * v13.823.360 (P1 financiero) — Al sincronizar conceptos de venta desde los
 * costos, el aviso antes calculaba `subtotal` sumando SÓLO los conceptos USD
 * (`usd.reduce`) y nunca derivaba `moneda` ni usaba el tipo de cambio
 * congelado: una cotización sólo MXN guardaba subtotal 0 y una mixta guardaba
 * un subtotal incompleto (agrava COT-2026-0237).
 *
 * Ahora reutiliza `derivarSubtotalMoneda` con el TC sellado leído en el sello
 * optimista. Casos: sólo USD, sólo MXN, mixta con TC y mixta sin TC
 * (falla cerrado, no toca la BD).
 *
 * NO ejecutado en Lovable; corre en GitHub Actions con el resto de la suite.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MSG_COTIZACION_MIXTA } from "@/features/cotizacion/services/derivarSubtotalMoneda";

const mutateAsync = vi.hoisted(() => vi.fn());
const notifyError = vi.hoisted(() => vi.fn());
const notifySuccess = vi.hoisted(() => vi.fn());
const fetchSello = vi.hoisted(() => vi.fn());

vi.mock("@/features/cotizacion/hooks", () => ({
  useUpdateCotizacion: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError, notifySuccess }));
vi.mock("@/features/cotizacion/services/updatedAt", () => ({
  fetchCotizacionSelloSync: fetchSello,
}));

import { AvisoSincronizarConceptosVenta } from "../AvisoSincronizarConceptosVenta";
import type { CostoCotizacion } from "@/features/cotizacion/types";

function costo(moneda: "USD" | "MXN", venta: number): CostoCotizacion {
  return {
    id: `c-${moneda}-${venta}`, cotizacion_id: "cot-1", concepto: `Flete ${moneda}`,
    moneda, proveedor: "ACME", cantidad: 1, costo_unitario: 100, costo_total: 100,
    precio_venta: venta, unidad_medida: "contenedor", notas: null,
    costeo_tarifa_id: null, costeo_tarifa_recargo_id: null,
    created_at: "", updated_at: "",
  } as unknown as CostoCotizacion;
}

function renderYClick(costos: CostoCotizacion[]) {
  render(
    <AvisoSincronizarConceptosVenta
      cotizacionId="cot-1" costos={costos} tasaIva={0.16} visible puedeSincronizar estadoCotizacion="Borrador"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Sincronizar conceptos de venta/i }));
}

/** `precio_unitario` del concepto ES la venta sin IVA; el encabezado suma esa base. */


describe("AvisoSincronizarConceptosVenta — subtotal y moneda coherentes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSello.mockResolvedValue({ updatedAt: "2026-09-13T10:00:00Z", moneda: null, tipoCambioUsd: null });
  });

  it("sólo USD: subtotal en USD y moneda USD", async () => {
    renderYClick([costo("USD", 1160)]);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    const { data } = mutateAsync.mock.calls[0][0];
    expect(data.moneda).toBe("USD");
    expect(data.subtotal).toBe(1160);
  });

  it("sólo MXN: subtotal incluye los conceptos MXN y moneda MXN (antes guardaba 0)", async () => {
    renderYClick([costo("MXN", 23200)]);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    const { data } = mutateAsync.mock.calls[0][0];
    expect(data.moneda).toBe("MXN");
    expect(data.subtotal).toBe(23200);
    expect(data.subtotal).toBeGreaterThan(0);
  });

  it("mixta con TC sellado: encabezado expresado en una sola moneda con el TC congelado", async () => {
    fetchSello.mockResolvedValue({ updatedAt: "s", moneda: "MXN", tipoCambioUsd: 20 });
    renderYClick([costo("USD", 1160), costo("MXN", 23200)]);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    const { data } = mutateAsync.mock.calls[0][0];
    expect(data.moneda).toBe("MXN");
    expect(data.subtotal).toBe(23200 + 1160 * 20);
  });

  it("mixta sin TC: falla cerrado con el mensaje de cotización mixta y NO escribe", async () => {
    renderYClick([costo("USD", 1160), costo("MXN", 23200)]);
    await waitFor(() => expect(notifyError).toHaveBeenCalled());
    expect(mutateAsync).not.toHaveBeenCalled();
    const args = notifyError.mock.calls[0][1];
    expect(args.description).toBe(MSG_COTIZACION_MIXTA);
  });

  it("sólo MXN con moneda canónica USD: gana la bolsa capturada (MXN)", async () => {
    fetchSello.mockResolvedValue({ updatedAt: "s", moneda: "USD", tipoCambioUsd: 20 });
    renderYClick([costo("MXN", 23200)]);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    const { data } = mutateAsync.mock.calls[0][0];
    expect(data.moneda).toBe("MXN");
  });
});
