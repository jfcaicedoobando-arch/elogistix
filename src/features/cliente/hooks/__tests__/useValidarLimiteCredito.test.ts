/**
 * Test unitario del hook useValidarLimiteCredito (Fase 3 · perfil de crédito).
 * Verifica que `rebasa` y `excedentePotencialMxn` reflejen correctamente el
 * cálculo `enUsoMxn + montoAdicional > limiteMxn`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/features/cliente/services/crud", () => ({
  fetchExposicionCreditoCliente: vi.fn(),
}));

import { useValidarLimiteCredito } from "../useValidarLimiteCredito";
import { fetchExposicionCreditoCliente } from "@/features/cliente/services/crud";

const mockFetch = fetchExposicionCreditoCliente as unknown as ReturnType<typeof vi.fn>;

const baseExp = {
  clienteId: "c1",
  organizationId: "o1",
  diasCredito: 30,
  limiteMxn: 100_000,
  enUsoMxn: 80_000,
  disponibleMxn: 20_000,
  excedido: false,
  facturasVivas: 3,
};

describe("useValidarLimiteCredito", () => {
  beforeEach(() => mockFetch.mockReset());

  it("marca rebasa=true cuando enUso + adicional > limite", async () => {
    mockFetch.mockResolvedValue(baseExp);
    const { result } = renderHook(() => useValidarLimiteCredito());
    let out: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      out = await result.current({ clienteId: "c1", montoAdicionalMxn: 30_000 });
    });
    expect(out!).not.toBeNull();
    expect(out!.rebasa).toBe(true);
    expect(out!.excedentePotencialMxn).toBe(10_000);
    expect(out!.totalProyectadoMxn).toBe(110_000);
  });

  it("marca rebasa=false cuando cabe dentro del límite", async () => {
    mockFetch.mockResolvedValue(baseExp);
    const { result } = renderHook(() => useValidarLimiteCredito());
    let out: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      out = await result.current({ clienteId: "c1", montoAdicionalMxn: 15_000 });
    });
    expect(out!.rebasa).toBe(false);
    expect(out!.excedentePotencialMxn).toBe(0);
  });

  it("devuelve null cuando el cliente no tiene límite configurado", async () => {
    mockFetch.mockResolvedValue({ ...baseExp, limiteMxn: null });
    const { result } = renderHook(() => useValidarLimiteCredito());
    let out: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      out = await result.current({ clienteId: "c1", montoAdicionalMxn: 1_000_000 });
    });
    expect(out).toBeNull();
  });

  it("trata montos negativos como 0 (no reduce la exposición)", async () => {
    mockFetch.mockResolvedValue(baseExp);
    const { result } = renderHook(() => useValidarLimiteCredito());
    let out: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      out = await result.current({ clienteId: "c1", montoAdicionalMxn: -50_000 });
    });
    expect(out!.totalProyectadoMxn).toBe(80_000);
    expect(out!.rebasa).toBe(false);
  });
});
