/**
 * Tests focalizados de `useActualizarEta` — mutación optimista de ETA.
 * Cubre: aplicación optimista en detail+full, rollback si falla, silent=true.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/features/embarques/services", () => ({
  actualizarEtaEmbarque: vi.fn(),
}));
vi.mock("@/components/shared/utils/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

import { actualizarEtaEmbarque } from "@/features/embarques/services";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";
import { useActualizarEta } from "@/features/embarques/hooks/mutations/useActualizarEta";
import { queryKeys } from "@/lib/query";

const mockSvc = vi.mocked(actualizarEtaEmbarque);
const mockErr = vi.mocked(notifyError);
const mockOk = vi.mocked(notifySuccess);

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("useActualizarEta", () => {
  beforeEach(() => vi.clearAllMocks());

  it("aplica optimismo sobre detail y full, y muestra toast de éxito", async () => {
    const { client, wrapper } = makeWrapper();
    const detailKey = queryKeys.embarques.detail("e-1");
    const fullKey = queryKeys.embarques.full("e-1");
    client.setQueryData(detailKey, { id: "e-1", eta_actual: "2026-01-01" });
    client.setQueryData(fullKey, { id: "e-1", eta_actual: "2026-01-01" });

    mockSvc.mockImplementation(async () => {
      // Durante la mutación el cache ya debe estar parcheado.
      expect((client.getQueryData(detailKey) as { eta_actual: string }).eta_actual).toBe("2026-02-15");
      expect((client.getQueryData(fullKey) as { eta_actual: string }).eta_actual).toBe("2026-02-15");
      return undefined as never;
    });

    const { result } = renderHook(() => useActualizarEta(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ embarqueId: "e-1", nuevaEta: "2026-02-15" });
    });
    expect(mockOk).toHaveBeenCalledWith(undefined, expect.objectContaining({ title: "ETA actualizada" }));
  });

  it("rollback: si el servicio falla, restaura eta_actual previo", async () => {
    const { client, wrapper } = makeWrapper();
    const detailKey = queryKeys.embarques.detail("e-2");
    client.setQueryData(detailKey, { id: "e-2", eta_actual: "2026-01-01" });
    mockSvc.mockRejectedValueOnce(new Error("network"));

    const { result } = renderHook(() => useActualizarEta(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ embarqueId: "e-2", nuevaEta: "2026-03-01" }).catch(() => {});
    });
    // Nota: tras onSettled, react-query invalida las queries y las marca stale,
    // pero como no hay queryFn registrado, el cache permanece con el snapshot restaurado.
    expect((client.getQueryData(detailKey) as { eta_actual: string }).eta_actual).toBe("2026-01-01");
    expect(mockErr).toHaveBeenCalled();
  });

  it("silent=true: no dispara toast de éxito ni de error", async () => {
    const { wrapper } = makeWrapper();
    mockSvc.mockResolvedValueOnce(undefined as never);
    const { result } = renderHook(() => useActualizarEta({ silent: true }), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ embarqueId: "e-3", nuevaEta: "2026-04-01" });
    });
    expect(mockOk).not.toHaveBeenCalled();
    expect(mockErr).not.toHaveBeenCalled();
  });

  it("updater es idempotente cuando el cache está vacío (no rompe)", async () => {
    const { wrapper } = makeWrapper();
    mockSvc.mockResolvedValueOnce(undefined as never);
    const { result } = renderHook(() => useActualizarEta(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ embarqueId: "e-4", nuevaEta: "2026-05-01" });
    });
    expect(mockSvc).toHaveBeenCalledWith("e-4", "2026-05-01");
  });
});
