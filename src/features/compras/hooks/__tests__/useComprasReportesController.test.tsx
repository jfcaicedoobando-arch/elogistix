import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test/utils/queryWrapper";
import { useComprasReportesController } from "../useComprasReportesController";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), descargar: vi.fn() }));
vi.mock("@/hooks/shared/useOrgFilter", () => ({
  useOrgFilter: () => ({ organizationId: "org-test", orgListo: true }),
}));
vi.mock("@/features/compras/services/reportesFetch", () => ({ fetchFacturasReporte: mocks.fetch }));
vi.mock("@/features/catalogos/services", () => ({
  fetchExchangeRates: async () => ({ usdMxn: 18.071, eurMxn: 20 }),
}));
vi.mock("@/lib/downloadBlob", () => ({ descargarBlob: mocks.descargar }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetch.mockResolvedValue([{
    id: "f1", fecha_emision: "2026-09-30", total: 700, moneda: "USD",
    proveedor_id: "p1", proveedor_nombre: "Agente", tipo_cambio_usd: 18.071,
  }]);
});

describe("Compras reportes — rango y exportación", () => {
  it("no consulta ni exporta un rango invertido y permite corregirlo", async () => {
    const { result } = renderHook(useComprasReportesController, { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.numFacturas).toBe(1));
    mocks.fetch.mockClear();
    act(() => {
      result.current.setDesde("2026-10-01");
      result.current.setHasta("2026-09-30");
    });
    expect(result.current.errorRango).toBe("La fecha Desde no puede ser posterior a Hasta.");
    act(() => result.current.handleExport());
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.descargar).not.toHaveBeenCalled();

    act(() => result.current.setHasta("2026-10-01"));
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledWith("2026-10-01", "2026-10-01", "org-test"));
    await waitFor(() => expect(result.current.numFacturas).toBe(1));
    expect(result.current.errorRango).toBeNull();
    act(() => result.current.handleExport());
    expect(mocks.descargar).toHaveBeenCalledTimes(1);
  });

  it.each(["desde", "hasta"] as const)("no consulta ni exporta con %s vacío", async (extremo) => {
    const { result } = renderHook(useComprasReportesController, { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.numFacturas).toBe(1));
    mocks.fetch.mockClear();
    act(() => (extremo === "desde" ? result.current.setDesde : result.current.setHasta)(""));
    expect(result.current.errorRango).toBe("Selecciona las fechas Desde y Hasta.");
    act(() => result.current.handleExport());
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.descargar).not.toHaveBeenCalled();
  });

  it("distingue un período válido sin registros del rango inválido", async () => {
    mocks.fetch.mockResolvedValue([]);
    const { result } = renderHook(useComprasReportesController, { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.errorRango).toBeNull();
    expect(result.current.numFacturas).toBe(0);
    act(() => result.current.handleExport());
    expect(mocks.descargar).not.toHaveBeenCalled();
  });
});
