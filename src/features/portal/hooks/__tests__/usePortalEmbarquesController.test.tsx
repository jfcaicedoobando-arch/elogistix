import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

vi.mock("@/hooks/portal/usePortalData", () => ({
  usePortalClientUsers: () => ({ data: [{ cliente_id: "c1" }] }),
  usePortalEmbarques: () => ({
    data: [
      {
        id: "e1", expediente: "EXP-001", cliente_nombre: "ACME",
        modo: "MAR", tipo: "FCL", etd: "2024-01-01", eta: "2024-02-01",
        estado: "Confirmado", contenedor: "ABCD1234567",
        puerto_origen: "MXLZC", puerto_destino: "CNSHA",
        aeropuerto_origen: null, aeropuerto_destino: null,
        ciudad_origen: null, ciudad_destino: null,
      },
      {
        id: "e2", expediente: "EXP-002", cliente_nombre: "Beta Corp",
        modo: "AER", tipo: "LCL", etd: "2024-01-10", eta: "2024-01-20",
        estado: "Reservado", contenedor: null,
        puerto_origen: null, puerto_destino: null,
        aeropuerto_origen: "MEX", aeropuerto_destino: "MIA",
        ciudad_origen: null, ciudad_destino: null,
      },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/features/embarques/domain/embarque", () => ({
  calcularEstadoEmbarque: (_modo: string, _tipo: string, _etd: unknown, _eta: unknown, estado: string) => estado,
}));

function makeWrapper(url = "/portal/embarques") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

import { usePortalEmbarquesController } from "../usePortalEmbarquesController";

describe("usePortalEmbarquesController", () => {
  it("devuelve todos los embarques sin filtros activos", () => {
    const { result } = renderHook(() => usePortalEmbarquesController(), {
      wrapper: makeWrapper(),
    });
    expect(result.current.filtered).toHaveLength(2);
    expect(result.current.isLoading).toBe(false);
  });

  it("search filtra por cliente_nombre", () => {
    const { result } = renderHook(() => usePortalEmbarquesController(), {
      wrapper: makeWrapper(),
    });
    act(() => { result.current.setSearch("acme"); });
    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].cliente_nombre).toBe("ACME");
  });

  it("lee filtro estado inicial de la URL", () => {
    const { result } = renderHook(() => usePortalEmbarquesController(), {
      wrapper: makeWrapper("/portal/embarques?estado=Reservado"),
    });
    expect(result.current.filtroEstado).toBe("Reservado");
  });
});
