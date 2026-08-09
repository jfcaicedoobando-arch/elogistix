/**
 * El hook debe tomar la organización activa del contexto (no de un parámetro
 * del componente) y pasarla a la RPC, además de incluirla en la queryKey para
 * que el cambio de tenant no reutilice la caché del anterior.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const fetchLibroPagos = vi.fn(async () => ({ desde: "", hasta: "", pagos: [] }));
vi.mock("@/features/tesoreria/services/libroPagos", () => ({
  fetchLibroPagos: (...a: unknown[]) => fetchLibroPagos(...(a as [])),
}));

let orgActiva: string | null = "org-a";
vi.mock("@/hooks/shared/useOrgFilter", () => ({
  useOrgFilter: () => ({ organizationId: orgActiva }),
}));

const { useLibroPagos } = await import("../useLibroPagos");

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useLibroPagos · alcance por organización", () => {
  beforeEach(() => {
    fetchLibroPagos.mockClear();
    orgActiva = "org-a";
  });

  it("pasa la organización activa al servicio", async () => {
    renderHook(() => useLibroPagos("2026-08-01", "2026-08-31"), { wrapper });
    await waitFor(() => expect(fetchLibroPagos).toHaveBeenCalled());
    expect(fetchLibroPagos).toHaveBeenCalledWith("2026-08-01", "2026-08-31", "org-a");
  });

  it("al cambiar de tenant pide los datos del nuevo, no los del anterior", async () => {
    renderHook(() => useLibroPagos("2026-08-01", "2026-08-31"), { wrapper });
    await waitFor(() => expect(fetchLibroPagos).toHaveBeenCalledTimes(1));
    fetchLibroPagos.mockClear();
    orgActiva = "org-b";
    renderHook(() => useLibroPagos("2026-08-01", "2026-08-31"), { wrapper });
    await waitFor(() => expect(fetchLibroPagos).toHaveBeenCalled());
    expect(fetchLibroPagos).toHaveBeenCalledWith("2026-08-01", "2026-08-31", "org-b");
  });

  it("sin organización activa envía null y el servidor decide", async () => {
    orgActiva = null;
    renderHook(() => useLibroPagos("2026-08-01", "2026-08-31"), { wrapper });
    await waitFor(() => expect(fetchLibroPagos).toHaveBeenCalled());
    expect(fetchLibroPagos).toHaveBeenCalledWith("2026-08-01", "2026-08-31", null);
  });
});
