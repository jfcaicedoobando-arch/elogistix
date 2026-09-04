/**
 * El id real de la bandeja de emitidas es "emitidas": con "facturas" la query
 * pesada del listado quedaba habilitada en TODOS los tabs.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const { useFacturasListadoMock } = vi.hoisted(() => ({ useFacturasListadoMock: vi.fn() }));

vi.mock("@/features/facturacion/hooks/useFacturas", () => ({
  useFacturasListado: (args: unknown) => useFacturasListadoMock(args),
}));
vi.mock("@/hooks/shared", () => ({
  useListPageState: () => ({
    search: "", filters: { estado: "todos", cliente: "todos" }, page: 0, pageSize: 100,
    setSearch: vi.fn(), setFilter: vi.fn(), setPage: vi.fn(), setPageSize: vi.fn(),
  }),
  useDebounce: <T,>(v: T) => v,
  useRegistrarActividad: () => ({ mutate: vi.fn() }),
  useToast: () => ({ toast: vi.fn() }),
  usePermissions: () => ({ canEdit: true }),
}));

import { useFacturacionPageController } from "../useFacturacionPageController";

beforeEach(() => {
  vi.clearAllMocks();
  useFacturasListadoMock.mockReturnValue({ data: { data: [], count: 0 }, isLoading: false });
});

const run = (activeTab: string) =>
  renderHook(() => useFacturacionPageController({ isInRange: () => true, activeTab }), {
    wrapper: createWrapper(),
  });

const enabledDeLaUltimaLlamada = () =>
  (useFacturasListadoMock.mock.calls.at(-1)?.[0] as { enabled?: boolean } | undefined)?.enabled;

describe("useFacturacionPageController · tab activo", () => {
  it("habilita el listado en 'emitidas'", () => {
    run("emitidas");
    expect(enabledDeLaUltimaLlamada()).toBe(true);
  });

  it("no lo habilita en otras bandejas", () => {
    run("por-timbrar");
    expect(enabledDeLaUltimaLlamada()).toBe(false);
  });
});
