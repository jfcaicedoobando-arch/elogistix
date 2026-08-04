/**
 * useTcInicial: precedencia DOF > servicio remoto.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const mockDof = vi.fn();
const mockRemoto = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => mockDof(),
}));
vi.mock("@/features/catalogos/hooks/useExchangeRates", () => ({
  useExchangeRates: () => mockRemoto(),
}));
vi.mock("@/features/catalogos/services/tipoCambioDof", () => ({
  fetchHistorialTcDof: vi.fn(),
}));
vi.mock("@/features/catalogos/hooks/useTipoCambioDof", () => ({
  tcDofKeys: { historial: (n: number) => ["tc", n] },
}));

import { useTcInicial } from "../useTcInicial";

describe("useTcInicial", () => {
  beforeEach(() => {
    mockDof.mockReset();
    mockRemoto.mockReset();
  });

  it("prefiere el T/C del DOF e informa su fecha", () => {
    mockDof.mockReturnValue({
      data: [{ fecha: "2026-08-04", usd_mxn: 18.1234, eur_mxn: 20.5 }],
      isLoading: false,
    });
    mockRemoto.mockReturnValue({ data: { usdMxn: 1, eurMxn: 1 }, isLoading: false });

    const { result } = renderHook(() => useTcInicial());
    expect(result.current.data).toEqual({
      usdMxn: 18.1234,
      eurMxn: 20.5,
      fecha: "2026-08-04",
      fuente: "DOF",
    });
  });

  it("cae al servicio remoto cuando el historial DOF viene vacío", () => {
    mockDof.mockReturnValue({ data: [], isLoading: false });
    mockRemoto.mockReturnValue({ data: { usdMxn: 17.5, eurMxn: 19 }, isLoading: false });

    const { result } = renderHook(() => useTcInicial());
    expect(result.current.data).toEqual({
      usdMxn: 17.5,
      eurMxn: 19,
      fecha: null,
      fuente: "remoto",
    });
  });

  it("no devuelve dato mientras el DOF carga", () => {
    mockDof.mockReturnValue({ data: undefined, isLoading: true });
    mockRemoto.mockReturnValue({ data: undefined, isLoading: false });

    const { result } = renderHook(() => useTcInicial());
    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });
});
