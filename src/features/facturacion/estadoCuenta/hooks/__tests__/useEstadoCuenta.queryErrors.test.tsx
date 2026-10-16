import type { PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEstadoCuenta } from "../useEstadoCuenta";
import type { FacturaEstadoCuenta } from "../../services/estadoCuenta";
import { KPIS_ESTADO_CUENTA_VACIOS } from "../../services/estadoCuentaKpisTypes";

const h = vi.hoisted(() => ({ rows: vi.fn(), kpis: vi.fn() }));
vi.mock("../../services/estadoCuenta", () => ({ fetchEstadoCuenta: h.rows, fetchEstadoCuentaKpis: h.kpis }));
const filters = { clienteIds: ["c1"], moneda: "todas" as const };
const row: FacturaEstadoCuenta = {
  id: "f1", numero: "F-1", cliente_id: "c1", cliente_nombre: "Cliente", expediente: "EXP-1",
  moneda: "MXN", total: 100, pagado: 0, notas_credito_aplicadas: 0, saldo: 100,
  fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-02", dias_vencido: 1,
  estatus_cobranza: "Vencida", estado_factura: "Emitida", pagos: [], notas_credito: [],
};
function wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
    {children}
  </QueryClientProvider>;
}
beforeEach(() => { h.rows.mockReset().mockResolvedValue([]); h.kpis.mockReset().mockResolvedValue(KPIS_ESTADO_CUENTA_VACIOS); });

describe("Estado de cuenta: contratos independientes del listado y KPI", () => {
  it.each([new Error("red"), { code: "LC_RESULTADO_TRUNCADO" }])("propaga error del listado y recupera con refetch (%j)", async error => {
    h.rows.mockRejectedValueOnce(error).mockResolvedValueOnce([row]);
    const { result } = renderHook(() => useEstadoCuenta(filters), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
    expect(result.current.hasData).toBe(false);
    expect(result.current.rows).toEqual([]);
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.isError).toBe(false));
    expect(result.current.rows).toEqual([row]);
    expect(result.current.hasData).toBe(true);
  });

  it("una respuesta vacía válida se distingue de no tener respuesta", async () => {
    const { result } = renderHook(() => useEstadoCuenta(filters), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasData).toBe(true);
    expect(result.current.rows).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("un refresco fallido retiene exclusivamente la última respuesta correcta", async () => {
    h.rows.mockResolvedValueOnce([row]).mockRejectedValueOnce(new Error("refresco"));
    const { result } = renderHook(() => useEstadoCuenta(filters), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.isRefetchError).toBe(true));
    expect(result.current.hasData).toBe(true);
    expect(result.current.rows).toEqual([row]);
  });

  it("un error inicial de RPC no contamina el estado del listado ni fabrica KPIs válidos", async () => {
    const error = new Error("RPC");
    h.rows.mockResolvedValue([row]);
    h.kpis.mockRejectedValueOnce(error).mockResolvedValueOnce(KPIS_ESTADO_CUENTA_VACIOS);
    const { result } = renderHook(() => useEstadoCuenta(filters), { wrapper });
    await waitFor(() => expect(result.current.kpisIsError).toBe(true));
    expect(result.current.isError).toBe(false);
    expect(result.current.rows).toEqual([row]);
    expect(result.current.kpisError).toBe(error);
    expect(result.current.kpisHasData).toBe(false);
    act(() => result.current.kpisRefetch());
    await waitFor(() => expect(result.current.kpisHasData).toBe(true));
    expect(result.current.kpisIsError).toBe(false);
    expect(h.rows).toHaveBeenCalledOnce();
    expect(h.kpis).toHaveBeenCalledTimes(2);
  });

  it("un refresco fallido de RPC conserva su último KPI, identificado como previo", async () => {
    const previous = { ...KPIS_ESTADO_CUENTA_VACIOS, adeudado_mxn: 500 };
    h.kpis.mockResolvedValueOnce(previous).mockRejectedValueOnce(new Error("refresco"));
    const { result } = renderHook(() => useEstadoCuenta(filters), { wrapper });
    await waitFor(() => expect(result.current.kpis.adeudado.mxn).toBe(500));
    act(() => result.current.kpisRefetch());
    await waitFor(() => expect(result.current.kpisIsError).toBe(true));
    expect(result.current.kpisHasData).toBe(true);
    expect(result.current.kpis.adeudado.mxn).toBe(500);
    expect(result.current.isError).toBe(false);
  });
});
