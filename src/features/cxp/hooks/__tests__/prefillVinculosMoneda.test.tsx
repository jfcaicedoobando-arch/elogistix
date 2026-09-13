/**
 * Regresión: al corregir la moneda de la factura (IA leyó MXN, era USD) la
 * precarga del buzón se vuelve a aplicar convertida, en lugar de dejar los
 * montos de la moneda anterior (bug de "montos que sobran" en el paso 3).
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import { usePrefillVinculosEntrante } from "../usePrefillVinculosEntrante";
import type { EntranteParaCaptura } from "@/features/cxp/types";

vi.mock("@/features/embarques/services/costosConFactura", () => ({
  fetchCostosConFactura: vi.fn(async () => new Set<string>()),
}));

const entrante = {
  id: "ent-1",
  embarqueId: "emb-1",
  conceptosSugeridos: [
    { conceptoCostoId: "c1", concepto: "Cargos Destino", monto: 51, moneda: "USD" },
  ],
} as unknown as EntranteParaCaptura;

const tc = { usdMxn: 17.0627, eurMxn: null };

describe("usePrefillVinculosEntrante · moneda de la factura", () => {
  it("re-aplica la precarga convertida cuando cambia la moneda", async () => {
    const aplicarSugerencias = vi.fn();
    const { rerender } = renderHook(
      ({ moneda }: { moneda: string }) =>
        usePrefillVinculosEntrante({
          entrante, abierto: true, habilitado: true,
          aplicarSugerencias, facturaMoneda: moneda, tc,
        }),
      { initialProps: { moneda: "MXN" } },
    );

    await waitFor(() => expect(aplicarSugerencias).toHaveBeenCalledTimes(1));
    expect(aplicarSugerencias.mock.calls[0][0][0].monto).toBeCloseTo(870.2, 1);

    rerender({ moneda: "USD" });
    await waitFor(() => expect(aplicarSugerencias).toHaveBeenCalledTimes(2));
    expect(aplicarSugerencias.mock.calls[1][0][0].monto).toBe(51);
  });

  it("no pre-marca cuando falta el tipo de cambio", async () => {
    const aplicarSugerencias = vi.fn();
    renderHook(() =>
      usePrefillVinculosEntrante({
        entrante, abierto: true, habilitado: true,
        aplicarSugerencias, facturaMoneda: "MXN", tc: null,
      }),
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(aplicarSugerencias).not.toHaveBeenCalled();
  });
});

describe("usePrefillVinculosEntrante · falla cerrado (bug 10)", () => {
  it("si fetchCostosConFactura lanza, no pre-marca nada y expone errorCubiertos", async () => {
    const { fetchCostosConFactura } = await import("@/features/embarques/services/costosConFactura");
    vi.mocked(fetchCostosConFactura).mockRejectedValueOnce(new Error("RLS"));
    const aplicarSugerencias = vi.fn();
    const { result } = renderHook(() =>
      usePrefillVinculosEntrante({
        entrante, abierto: true, habilitado: true,
        aplicarSugerencias, facturaMoneda: "USD", tc,
      }),
    );

    await waitFor(() => expect(result.current.errorCubiertos).toBe(true));
    expect(aplicarSugerencias).not.toHaveBeenCalled();
    expect(result.current.aplicados).toHaveLength(0);

    vi.mocked(fetchCostosConFactura).mockResolvedValueOnce(new Set());
    act(() => { result.current.reintentar(); });
    await waitFor(() => expect(result.current.errorCubiertos).toBe(false));
    await waitFor(() => expect(aplicarSugerencias).toHaveBeenCalledTimes(1));
  });
});
