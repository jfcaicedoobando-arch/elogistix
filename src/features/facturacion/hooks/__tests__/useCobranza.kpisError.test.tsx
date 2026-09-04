/**
 * Fail-closed de los KPIs de cobranza: si la RPC remota falla, sus valores
 * NO se presentan como confiables ni se sustituyen en silencio por los de la
 * página cargada. El hook expone `kpisIsError` + `kpisRefetch`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

vi.mock("@/features/facturacion/services", () => ({
  fetchCobranza: vi.fn(),
  fetchCobranzaKpis: vi.fn(),
  calcularKPIs: () => ({
    total_mxn: 111, total_usd: 0, vencido_mxn: 0, vencido_usd: 0,
    facturas_vencidas: 0,
  }),
}));

import { fetchCobranza, fetchCobranzaKpis } from "@/features/facturacion/services";
import { useCobranza } from "../useCobranza";

const mockLista = vi.mocked(fetchCobranza);
const mockKpis = vi.mocked(fetchCobranzaKpis);

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => { vi.clearAllMocks(); });

describe("useCobranza · KPIs remotos", () => {
  it("marca kpisIsError cuando la RPC falla y conserva la tabla", async () => {
    mockLista.mockResolvedValue([{ id: "f1" } as never]);
    mockKpis.mockRejectedValue(new Error("rpc caída"));

    const { result } = renderHook(() => useCobranza({}), { wrapper });
    await waitFor(() => expect(result.current.kpisIsError).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.isError).toBe(true);
    expect(typeof result.current.kpisRefetch).toBe("function");
  });

  it("sin error remoto no marca kpisIsError y mezcla los agregados", async () => {
    mockLista.mockResolvedValue([]);
    mockKpis.mockResolvedValue({ total_mxn: 999 } as never);

    const { result } = renderHook(() => useCobranza({}), { wrapper });
    await waitFor(() => expect(result.current.kpis.total_mxn).toBe(999));
    expect(result.current.kpisIsError).toBe(false);
  });

  it("con filtros que impiden la RPC no reporta error remoto", async () => {
    mockLista.mockResolvedValue([]);
    const { result } = renderHook(() => useCobranza({ search: "acme" }), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockKpis).not.toHaveBeenCalled();
    expect(result.current.kpisIsError).toBe(false);
  });
});
