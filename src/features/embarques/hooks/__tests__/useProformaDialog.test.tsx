import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const { mockDiasCredito, mockClientePdf } = vi.hoisted(() => ({
  mockDiasCredito: vi.fn(),
  mockClientePdf: vi.fn(),
}));

vi.mock("@/features/cliente/services", () => ({
  fetchDiasCreditoCliente: mockDiasCredito,
}));

vi.mock("@/features/proformas/services", () => ({
  fetchClienteParaPdf: mockClientePdf,
  fetchProformasEmbarque: vi.fn(),
  fetchProformasPendientes: vi.fn(),
  crearProforma: vi.fn(),
  eliminarProforma: vi.fn(),
  aprobarProformas: vi.fn(),
  consolidarProformas: vi.fn(),
  marcarProformaFacturada: vi.fn(),
}));

import { useDiasCreditoCliente, useFetchClienteParaPdf } from "../useProformaDialog";

beforeEach(() => {
  mockDiasCredito.mockReset();
  mockClientePdf.mockReset();
});

describe("useDiasCreditoCliente", () => {
  it("retorna días de crédito del cliente", async () => {
    mockDiasCredito.mockResolvedValue(30);
    const { result } = renderHook(() => useDiasCreditoCliente("cli-1", true), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(30);
  });

  it("no ejecuta query si clienteId es undefined", () => {
    const { result } = renderHook(() => useDiasCreditoCliente(undefined, true), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockDiasCredito).not.toHaveBeenCalled();
  });
});

describe("useFetchClienteParaPdf", () => {
  it("retorna función que hace fetchQuery del cliente", async () => {
    const clienteStub = { id: "cli-1", nombre: "ACME" };
    mockClientePdf.mockResolvedValue(clienteStub);
    const { result } = renderHook(() => useFetchClienteParaPdf(), {
      wrapper: createWrapper(),
    });
    const cliente = await result.current("cli-1");
    expect(cliente).toEqual(clienteStub);
  });
});
