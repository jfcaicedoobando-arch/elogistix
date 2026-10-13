import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ org: { organizationId: "org-a" as string | null, orgListo: true }, fetch: vi.fn(), csv: vi.fn() }));
vi.mock("@/hooks/shared", () => ({ useOrgFilter: () => mocks.org }));
vi.mock("@/features/facturacion/services", () => ({ fetchProyeccionMes: mocks.fetch }));
vi.mock("@/generators/exportCsv", () => ({ exportToCsv: mocks.csv }));
import type { FilaProyeccion } from "@/features/facturacion/domain/proyeccionFacturacion";
import { useTabProyeccionController } from "../useTabProyeccionController";
const rows = (name: string): FilaProyeccion[] => [{
  embarque_id: name, expediente: name, cliente_nombre: name, operador: name,
  eta: "2026-10-01", contenedor: null, tipo_cambio_usd: 20, tipo_cambio_eur: 22,
  sin_tc: false, tiene_proforma: true, tiene_factura_pdf: false,
  venta_usd: 10, venta_mxn: 200, costo_usd: 5, costo_mxn: 100,
}];
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; };
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>;
}
beforeEach(() => { mocks.org = { organizationId: "org-a", orgListo: true }; mocks.fetch.mockReset().mockResolvedValue(rows("A")); mocks.csv.mockReset(); });
it.each([{ organizationId: null, orgListo: false }, { organizationId: "org-a", orgListo: false }, { organizationId: null, orgListo: true }])("blocks query, manual refetch and CSV without a ready tenant: %j", async (org) => {
  mocks.org = org;
  const { result } = renderHook(useTabProyeccionController, { wrapper: wrapper() });
  await act(async () => { await result.current.refetch(); });
  act(() => result.current.exportarCsv());
  expect(mocks.fetch).not.toHaveBeenCalled(); expect(mocks.csv).not.toHaveBeenCalled(); expect(result.current.grupos).toEqual([]);
});
it("starts when the tenant becomes ready", async () => {
  mocks.org.orgListo = false;
  const { result, rerender } = renderHook(useTabProyeccionController, { wrapper: wrapper() });
  expect(mocks.fetch).not.toHaveBeenCalled();
  mocks.org.orgListo = true; rerender();
  await waitFor(() => expect(result.current.grupos[0]?.cliente_nombre).toBe("A"));
  act(() => result.current.exportarCsv()); expect(mocks.csv).toHaveBeenCalledTimes(1);
});
it("discards late A after switching to B and exports only B", async () => {
  const a = deferred<ReturnType<typeof rows>>(), b = deferred<ReturnType<typeof rows>>();
  mocks.fetch.mockImplementation(({ organizationId }: { organizationId: string }) => organizationId === "org-a" ? a.promise : b.promise);
  const { result, rerender } = renderHook(useTabProyeccionController, { wrapper: wrapper() });
  mocks.org.organizationId = "org-b"; rerender();
  act(() => result.current.exportarCsv()); expect(mocks.csv).not.toHaveBeenCalled();
  await act(async () => { b.resolve(rows("B")); });
  await waitFor(() => expect(result.current.grupos[0]?.cliente_nombre).toBe("B"));
  await act(async () => { a.resolve(rows("A")); });
  expect(result.current.grupos.map((g) => g.cliente_nombre)).toEqual(["B"]);
  act(() => result.current.exportarCsv());
  expect(JSON.stringify(mocks.csv.mock.calls[0])).toContain('B');
});
it("hides cached rows and blocks stale export callbacks during a tenant transition", async () => {
  const { result, rerender } = renderHook(useTabProyeccionController, { wrapper: wrapper() });
  await waitFor(() => expect(result.current.grupos).toHaveLength(1));
  const oldExport = result.current.exportarCsv;
  mocks.org.orgListo = false; rerender();
  expect(result.current.grupos).toEqual([]);
  act(() => { oldExport(); result.current.exportarCsv(); });
  expect(mocks.csv).not.toHaveBeenCalled();
  mocks.org = { organizationId: "org-b", orgListo: true }; mocks.fetch.mockResolvedValue(rows("B")); rerender();
  await waitFor(() => expect(result.current.grupos[0]?.cliente_nombre).toBe("B"));
  act(() => oldExport()); expect(mocks.csv).not.toHaveBeenCalled();
});
it("blocks CSV and hides old rows while refetching and after error", async () => {
  const { result } = renderHook(useTabProyeccionController, { wrapper: wrapper() });
  await waitFor(() => expect(result.current.grupos).toHaveLength(1));
  const oldExport = result.current.exportarCsv;
  const next = deferred<ReturnType<typeof rows>>(); mocks.fetch.mockReturnValue(next.promise);
  act(() => { void result.current.refetch(); });
  await waitFor(() => expect(result.current.isFetching).toBe(true));
  expect(result.current.grupos).toEqual([]);
  act(() => { oldExport(); result.current.exportarCsv(); }); expect(mocks.csv).not.toHaveBeenCalled();
  await act(async () => { next.resolve(rows("A")); });
  await waitFor(() => expect(result.current.isFetching).toBe(false));
  mocks.fetch.mockRejectedValue(new Error("failed"));
  await act(async () => { await result.current.refetch(); });
  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(result.current.grupos).toEqual([]);
  act(() => result.current.exportarCsv()); expect(mocks.csv).not.toHaveBeenCalled();
});
it("blocks old export snapshots after a successful refresh changes rows", async () => {
  const { result } = renderHook(useTabProyeccionController, { wrapper: wrapper() });
  await waitFor(() => expect(result.current.grupos).toHaveLength(1));
  const oldExport = result.current.exportarCsv;
  mocks.fetch.mockResolvedValue(rows("updated"));
  await act(async () => { await result.current.refetch(); });
  await waitFor(() => expect(result.current.grupos[0]?.cliente_nombre).toBe("updated"));
  act(() => oldExport()); expect(mocks.csv).not.toHaveBeenCalled();
  act(() => result.current.exportarCsv()); expect(mocks.csv).toHaveBeenCalledTimes(1);
});
