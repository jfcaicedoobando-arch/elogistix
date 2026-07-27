/**
 * FIX-10 (auditoría): valida que el hook rechaza `esFallback: true` y NO
 * auto-guarda un TC falso en la factura, forzando reintento al usuario.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const mocks = vi.hoisted(() => ({
  fetchExchangeRates: vi.fn(),
  toastSuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("@/features/catalogos/services", () => ({
  fetchExchangeRates: mocks.fetchExchangeRates,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: vi.fn() },
}));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: mocks.notifyError,
  notifySuccess: (_t: unknown, opts: { title: string }) => mocks.toastSuccess(opts?.title),
}));

import { useBanxicoTipoCambio } from "../useBanxicoTipoCambio";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  mocks.fetchExchangeRates.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.notifyError.mockReset();
});

describe("useBanxicoTipoCambio · FIX-10 fallback guard", () => {
  it("NO invoca onTC ni muestra success cuando la edge marca esFallback: true", async () => {
    mocks.fetchExchangeRates.mockResolvedValue({
      usdMxn: 17.25, eurMxn: 18.5, esFallback: true,
    });
    const onTC = vi.fn();
    const { result } = renderHook(() => useBanxicoTipoCambio("USD", onTC), { wrapper });

    await act(async () => { result.current.mutate(); });
    await waitFor(() => expect(mocks.notifyError).toHaveBeenCalled());

    expect(onTC).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    const call = mocks.notifyError.mock.calls[0][1];
    expect(String(call.error?.message ?? "")).toContain("LC_TC_DOF_NO_DISPONIBLE");
  });

  it("invoca onTC con el TC real cuando la edge devuelve datos frescos", async () => {
    mocks.fetchExchangeRates.mockResolvedValue({
      usdMxn: 18.42, eurMxn: 19.9, esFallback: false,
    });
    const onTC = vi.fn();
    const { result } = renderHook(() => useBanxicoTipoCambio("USD", onTC), { wrapper });

    await act(async () => { result.current.mutate(); });
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalled());

    expect(onTC).toHaveBeenCalledWith(18.42);
    expect(mocks.notifyError).not.toHaveBeenCalled();
  });
});
