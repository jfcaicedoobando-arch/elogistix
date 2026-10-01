import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test/utils/queryWrapper";
import { useCarteraAging } from "../useCarteraAging";
import type { TcDofVigente } from "@/features/catalogos/services/tipoCambioDof";

const mocks = vi.hoisted(() => ({ fetchTc: vi.fn(), refetchCxc: vi.fn(), refetchCxp: vi.fn() }));
vi.mock("@/features/catalogos/services/tipoCambioDof", () => ({ fetchTcDofPorFecha: mocks.fetchTc }));
vi.mock("@/features/facturacion/hooks/useCobranza", () => ({
  useCobranza: () => ({ data: [], isLoading: false, isError: false, refetch: mocks.refetchCxc }),
}));
vi.mock("@/features/cxp/hooks", () => ({
  useFacturasCxP: () => ({
    data: [{
      id: "fp-7", folio_interno: "FP-000007", proveedor_nombre: "Agente marítimo Monterrey",
      embarque_expediente: "ELIMP00010", moneda: "USD", saldo: 700,
      fecha_emision: "2026-09-26", fecha_vencimiento: "2026-09-27", tipo_cambio_usd: 17.5,
    }],
    isLoading: false, isError: false, refetch: mocks.refetchCxp,
  }),
}));

const tc: TcDofVigente = { usdMxn: 18.071, eurMxn: null, fecha: "2026-09-30", exacto: true };

beforeEach(() => vi.clearAllMocks());

describe("Cartera — resolución del tipo de cambio", () => {
  it("no declara listo el reporte mientras el TC sigue pendiente", async () => {
    let resolver!: (value: TcDofVigente) => void;
    mocks.fetchTc.mockReturnValue(new Promise<TcDofVigente>((resolve) => { resolver = resolve; }));
    const { result } = renderHook(() => useCarteraAging("2026-09-30", ""), { wrapper: createWrapper() });
    expect(result.current.tcLoading).toBe(true);
    expect(result.current.isLoading).toBe(true);
    act(() => resolver(tc));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.cxp.total.mxnHistorico).toBe(12250);
    expect(result.current.cxp.total.mxnCorte).toBe(12649.7);
    expect(result.current.cxp.total.diferencia).toBe(399.7);
  });

  it("una consulta resuelta sin TC conserva el fallback histórico explícito", async () => {
    mocks.fetchTc.mockResolvedValue(null);
    const { result } = renderHook(() => useCarteraAging("2026-09-30", "FP-000007"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.tcLoading).toBe(false));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.tc).toBeNull();
    expect(result.current.cxp.total.mxnCorte).toBe(12250);
  });

  it("un error de TC invalida el reporte y Reintentar vuelve a consultar las tres fuentes", async () => {
    mocks.fetchTc.mockRejectedValue(new Error("TC DOF no disponible por red"));
    const { result } = renderHook(() => useCarteraAging("2026-09-30", ""), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.tcError).toBe(true), { timeout: 4000 });
    expect(result.current.isError).toBe(true);
    mocks.fetchTc.mockResolvedValue(tc);
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.isError).toBe(false));
    expect(mocks.refetchCxc).toHaveBeenCalledTimes(1);
    expect(mocks.refetchCxp).toHaveBeenCalledTimes(1);
    expect(result.current.cxp.total.mxnCorte).toBe(12649.7);
  });
});
