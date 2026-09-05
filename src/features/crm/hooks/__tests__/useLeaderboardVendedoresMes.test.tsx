/**
 * El ranking del mes debe usar el calendario de negocio MX: en el borde de mes
 * (31 de agosto por la noche en CDMX ya es 1 de septiembre en UTC) el año, mes
 * y el día 1 enviados al servicio no deben saltar de periodo.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const fetchLeaderboardRaw = vi.fn();
vi.mock("@/features/crm/services", () => ({
  fetchLeaderboardRaw: (...args: unknown[]) => fetchLeaderboardRaw(...args),
  computeLeaderboard: (raw: unknown) => raw,
}));

import { useLeaderboardVendedores } from "../useLeaderboardVendedores";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

async function argumentosConReloj(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
  fetchLeaderboardRaw.mockReset();
  fetchLeaderboardRaw.mockResolvedValue([]);

  renderHook(() => useLeaderboardVendedores(), { wrapper });
  vi.useRealTimers();
  await waitFor(() => expect(fetchLeaderboardRaw).toHaveBeenCalled());
  return fetchLeaderboardRaw.mock.calls[0];
}

describe("useLeaderboardVendedores · mes de negocio MX", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("conserva agosto la noche del 31 en CDMX", async () => {
    // 2026-09-01T04:00Z = 2026-08-31 22:00 en America/Mexico_City.
    const [anio, mes, inicioMes, finMes] = await argumentosConReloj("2026-09-01T04:00:00Z");
    expect(anio).toBe(2026);
    expect(mes).toBe(8);
    expect(inicioMes).toBe("2026-08-01");
    expect(finMes).toBe("2026-09-01");
  });

  it("cambia a septiembre ya entrado el día 1 en CDMX", async () => {
    const [anio, mes, inicioMes, finMes] = await argumentosConReloj("2026-09-01T12:00:00Z");
    expect(anio).toBe(2026);
    expect(mes).toBe(9);
    expect(inicioMes).toBe("2026-09-01");
    expect(finMes).toBe("2026-10-01");
  });
});
