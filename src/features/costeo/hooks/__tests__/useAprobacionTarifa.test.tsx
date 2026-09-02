import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useAprobacionTarifa } from "../useAprobacionTarifa";
import * as aprobacionService from "@/features/costeo/services/aprobacion";
import { todayLocalISO } from "@/lib/date/today";

vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

afterEach(() => vi.restoreAllMocks());

describe("useAprobacionTarifa — guard de vigencia", () => {
  it("rechaza aprobar una tarifa con vigencia vencida sin llamar al servicio", async () => {
    const spy = vi.spyOn(aprobacionService, "aprobarTarifa").mockResolvedValue(undefined);
    const { result } = renderHook(() => useAprobacionTarifa(), { wrapper });

    const ayer = "2000-01-01";
    result.current.aprobar.mutate({ id: "t1", vigenteHasta: ayer });

    await waitFor(() => expect(result.current.aprobar.isError).toBe(true));
    expect(spy).not.toHaveBeenCalled();
    expect(String(result.current.aprobar.error)).toContain("No puedes aprobar una tarifa con vigencia vencida");
  });

  it("permite aprobar una tarifa vigente", async () => {
    const spy = vi.spyOn(aprobacionService, "aprobarTarifa").mockResolvedValue(undefined);
    const { result } = renderHook(() => useAprobacionTarifa(), { wrapper });

    result.current.aprobar.mutate({ id: "t1", vigenteHasta: todayLocalISO() });

    await waitFor(() => expect(result.current.aprobar.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith("t1");
  });
});
