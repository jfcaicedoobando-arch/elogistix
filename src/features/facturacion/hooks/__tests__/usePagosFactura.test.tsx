import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

vi.mock("@/features/facturacion/services/pagos", () => ({
  listarPagosFactura: vi.fn(),
  registrarPagoFactura: vi.fn(),
  eliminarPagoFactura: vi.fn(),
}));
vi.mock("@/lib/query", () => ({
  queryKeys: {
    facturas: {
      all: ["facturas"],
      pagos: (id: string) => ["facturas", "pagos", id],
    },
    dashboardEjecutivo: { all: ["dashboard-ejecutivo"] },
    direccion: { all: ["direccion"] },
    presupuesto: { all: ["presupuesto"] },
    profit: { all: ["profit"] },
    cxc: { all: ["cxc"] },
    bandejas: { carteraPendiente: ["bandeja", "cartera-pendiente"] },
  },
}));

import {
  listarPagosFactura,
  registrarPagoFactura,
  eliminarPagoFactura,
} from "@/features/facturacion/services/pagos";
import { usePagosFactura, useRegistrarPagoFactura, useEliminarPagoFactura } from "../usePagosFactura";

const mockListar = vi.mocked(listarPagosFactura);
const mockRegistrar = vi.mocked(registrarPagoFactura);
const mockEliminar = vi.mocked(eliminarPagoFactura);

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

// v13.309.24 (Anexo A): mockReset restaura implementaciones default, no sólo calls.
// Previene flakes bajo paralelismo pesado donde un mock resuelto en un test
// contamina al siguiente si sólo se llamó clearAllMocks.
beforeEach(() => {
  mockListar.mockReset();
  mockRegistrar.mockReset();
  mockEliminar.mockReset();
});

describe("usePagosFactura", () => {
  it("happy path: retorna lista de pagos para un facturaId", async () => {
    mockListar.mockResolvedValue([{ id: "p1", monto: 500 }] as never);
    const { result } = renderHook(() => usePagosFactura("fac-1"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(1);
  });

  it("no hace fetch cuando facturaId es undefined", () => {
    const { result } = renderHook(() => usePagosFactura(undefined), { wrapper: makeWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockListar).not.toHaveBeenCalled();
  });
});

describe("useRegistrarPagoFactura", () => {
  it("happy path: llama registrarPagoFactura e invalida queries", async () => {
    mockRegistrar.mockResolvedValue({ id: "p2" } as never);
    const { result } = renderHook(() => useRegistrarPagoFactura(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ factura_id: "fac-1", monto: 200 } as never);
    });
    expect(mockRegistrar).toHaveBeenCalledWith({ factura_id: "fac-1", monto: 200 });
  });

  it("error path: mutation queda en error cuando el servicio falla", async () => {
    mockRegistrar.mockRejectedValue(new Error("DB error"));
    const { result } = renderHook(() => useRegistrarPagoFactura(), { wrapper: makeWrapper() });
    await act(async () => {
      result.current.mutate({ factura_id: "fac-1", monto: 200 } as never);
    });
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });
  });
});

describe("useEliminarPagoFactura", () => {
  it("happy path: llama eliminarPagoFactura con el id correcto", async () => {
    mockEliminar.mockResolvedValue(undefined as never);
    const { result } = renderHook(() => useEliminarPagoFactura(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ id: "p1", facturaId: "fac-1" });
    });
    expect(mockEliminar).toHaveBeenCalledWith("p1");
  });
});
