import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useAprobacionTarifa } from "../useAprobacionTarifa";
import * as aprobacionService from "@/features/costeo/services/aprobacion";

vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

afterEach(() => vi.restoreAllMocks());

describe("useAprobacionTarifa — delega el guard de vigencia al servicio", () => {
  it("no confía en la fila de la UI: sólo manda el id al servicio verificado", async () => {
    const spy = vi.spyOn(aprobacionService, "aprobarTarifaVerificada").mockResolvedValue(undefined);
    const { result } = renderHook(() => useAprobacionTarifa(), { wrapper });

    result.current.aprobar.mutate({ id: "t1" });

    await waitFor(() => expect(result.current.aprobar.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith("t1");
  });

  it("propaga el mensaje visible cuando el servicio bloquea por vigencia vencida", async () => {
    vi.spyOn(aprobacionService, "aprobarTarifaVerificada").mockRejectedValue(
      new Error("No puedes aprobar una tarifa con vigencia vencida"),
    );
    const { result } = renderHook(() => useAprobacionTarifa(), { wrapper });

    result.current.aprobar.mutate({ id: "t1" });

    await waitFor(() => expect(result.current.aprobar.isError).toBe(true));
    expect(String(result.current.aprobar.error)).toContain("vigencia vencida");
  });
});
