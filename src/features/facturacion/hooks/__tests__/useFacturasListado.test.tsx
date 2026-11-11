import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";
const mocks = vi.hoisted(() => ({ listado: vi.fn(), clientes: vi.fn() }));
vi.mock("@/hooks/shared", () => ({ useOrgFilter: () => ({ organizationId: "org" }) }));
vi.mock("@/features/facturacion/services", () => ({ fetchFacturas: vi.fn(), fetchFacturasListado: mocks.listado }));
vi.mock("@/features/facturacion/services/facturasCrud", () => ({ fetchFacturasClientes: mocks.clientes }));
import { useFacturasListado, useFacturasClientes } from "../useFacturas";

beforeEach(() => { vi.clearAllMocks(); });

describe("consultas del historial de facturas", () => {
  it("cambia la consulta y la caché por cliente y fechas sin reutilizar filas del filtro anterior", async () => {
    mocks.listado.mockImplementation(async (args: { clienteNombre: string; fechaDesde: string }) => ({
      data: [{ id: `${args.clienteNombre}:${args.fechaDesde}` }], count: 121,
    }));
    const initial = { page: 1, pageSize: 50, clienteNombre: "ACME", estado: "Emitida", fechaDesde: "2026-01-01", fechaHasta: "2026-01-31" };
    const { result, rerender } = renderHook((opts) => useFacturasListado(opts), { initialProps: initial, wrapper: createWrapper() });
    await waitFor(() => expect(result.current.data?.data[0].id).toBe("ACME:2026-01-01"));
    expect(result.current.data?.count).toBe(121);
    expect(mocks.listado).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org", ...initial }));
    rerender({ ...initial, clienteNombre: "Beta" });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data?.data[0].id).toBe("Beta:2026-01-01"));
    rerender({ ...initial, clienteNombre: "Beta", fechaDesde: "2026-01-15" });
    await waitFor(() => expect(result.current.data?.data[0].id).toBe("Beta:2026-01-15"));
    expect(mocks.listado).toHaveBeenCalledTimes(3);
  });

  it("consulta opciones completas una sola vez al navegar por páginas", async () => {
    mocks.clientes.mockResolvedValue([{ id: "Fuera de página", nombre: "Fuera de página" }]);
    mocks.listado.mockResolvedValue({ data: [], count: 0 });
    const { result, rerender } = renderHook(({ page }) => ({
      lista: useFacturasListado({ page, pageSize: 50 }), clientes: useFacturasClientes(true),
    }), { initialProps: { page: 0 }, wrapper: createWrapper() });
    await waitFor(() => expect(result.current.clientes.data).toHaveLength(1));
    rerender({ page: 1 });
    await waitFor(() => expect(mocks.listado).toHaveBeenCalledTimes(2));
    expect(mocks.clientes).toHaveBeenCalledExactlyOnceWith("org");
    expect(result.current.clientes.data?.[0].id).toBe("Fuera de página");
  });
});
