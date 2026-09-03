import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

afterEach(() => {
  vi.clearAllMocks();
});


const convertirProspectoACliente = vi.hoisted(() => vi.fn());
const crearEmbarqueBorradorDesdeCotizacion = vi.hoisted(() => vi.fn());

vi.mock("@/features/cotizacion/services", () => ({
  convertirProspectoACliente,
  crearEmbarqueBorradorDesdeCotizacion,
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/lib/query", () => ({
  queryKeys: {
    cotizaciones: { all: ["cotizaciones"], detail: (id: string) => ["cotizaciones", id] },
    clientes: { all: ["clientes"] },
    embarques: { all: ["embarques"] },
    crm: { all: ["crm"] },
  },
}));

import {
  useConvertirProspectoACliente,
  useCrearEmbarqueBorrador,
} from "../useCotizacionConversions";

describe("useConvertirProspectoACliente", () => {
  it("happy path: invoca el servicio y resuelve", async () => {
    convertirProspectoACliente.mockResolvedValueOnce({ clienteId: "cli-1" });
    const { result } = renderHook(() => useConvertirProspectoACliente(), { wrapper: createWrapper() });
    result.current.mutate({ cotizacionId: "cot-1", clienteData: { nombre: "ACME" } as never });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(convertirProspectoACliente).toHaveBeenCalled();
  });
});

// FIX-07 (v13.303.12) — el hook `useConvertirCotizacionAEmbarques` se eliminó;
// toda conversión pasa por `useCrearEmbarqueBorrador` (RPC transaccional).

describe("useCrearEmbarqueBorrador", () => {
  it("happy path: llama al servicio con cotizacionId", async () => {
    crearEmbarqueBorradorDesdeCotizacion.mockResolvedValueOnce("emb-1");
    const { result } = renderHook(() => useCrearEmbarqueBorrador(), { wrapper: createWrapper() });
    result.current.mutate("cot-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(crearEmbarqueBorradorDesdeCotizacion).toHaveBeenCalledWith("cot-1");
  });
});
