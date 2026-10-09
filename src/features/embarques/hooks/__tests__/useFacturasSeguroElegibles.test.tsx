import { act, renderHook, waitFor } from "@testing-library/react";
import { focusManager, useQueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query";
import { createWrapper } from "@/test/utils/queryWrapper";
import type { FacturasSeguroPage } from "../../services/seguros";
const state = vi.hoisted(() => ({ fetch: vi.fn(), user: "user-a", org: "org-a", role: "coordinador_logistico", loading: false }));
vi.mock("@/features/embarques/services/seguros", () => ({ fetchFacturasSeguroElegibles: state.fetch }));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: state.user }, effectiveRole: state.role, loading: state.loading }) }));
vi.mock("@/lib/contexts/OrganizationContext", () => ({ useOrganization: () => ({ organizationId: state.org, loading: false }) }));
import { useFacturasSeguroElegibles, type FacturasSeguroContext } from "../useFacturasSeguroElegibles";
import { invalidateSeguroFacturaDependencies } from "@/lib/query/invalidateSeguroFacturaDependencies";
import { resetSessionCaches } from "@/lib/auth/sessionCacheRegistry";
const context: FacturasSeguroContext = {
  embarqueId: "shipment-a", prima: "100.005", moneda: "MXN", seguroId: "policy-a",
  tipoCambioUsd: 20, tipoCambioEur: 22, open: true,
};
const factura = { id: "invoice-a", folio_interno: "FP-1", proveedor_nombre: "Insurance", subtotal: "100.00", moneda: "MXN" };
const page: FacturasSeguroPage = { items: [factura], next_cursor: null };
function deferred() {
  let resolve!: (page: FacturasSeguroPage) => void;
  return { promise: new Promise<FacturasSeguroPage>((r) => { resolve = r; }), resolve: (p: FacturasSeguroPage) => resolve(p) };
}
beforeEach(() => {
  state.fetch.mockReset().mockResolvedValue(page); state.user = "user-a"; state.org = "org-a";
  state.role = "coordinador_logistico"; state.loading = false;
});

describe("authoritative selector query lifecycle", () => {
  it("uses the canonical input and invalidation prefix with private context and fresh-open/focus policy", async () => {
    const { result } = renderHook(() => ({ query: useFacturasSeguroElegibles(context), client: useQueryClient() }), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.query.items).toEqual(page.items));
    expect(state.fetch).toHaveBeenCalledWith({ embarqueId: "shipment-a", prima: "100.01", moneda: "MXN", seguroId: "policy-a", cursor: null }, expect.any(AbortSignal));
    const prefix = queryKeys.embarques.segurosFacturasElegibles("shipment-a");
    const cached = result.current.client.getQueryCache().find({ queryKey: prefix, exact: false });
    expect(cached?.queryKey).toEqual([...prefix, "user-a", "org-a", "coordinador_logistico", expect.any(Number), "100.01", "MXN", "policy-a", 20, 22, "selector148-v1", true, true]);
    expect(cached).toMatchObject({ options: { staleTime: 0, gcTime: 0, refetchOnWindowFocus: "always", refetchOnMount: "always" } });
    await act(async () => { await result.current.client.invalidateQueries({ queryKey: prefix }); });
    expect(state.fetch).toHaveBeenCalledTimes(2);
    await act(async () => { await invalidateSeguroFacturaDependencies(result.current.client); });
    expect(state.fetch).toHaveBeenCalledTimes(3);
  });

  it("fetches later pages including more than100 rows with the returned cursor", async () => {
    const next = { fecha_emision: "2026-10-01", id: "invoice-100" };
    state.fetch.mockResolvedValueOnce({ items: Array.from({ length: 100 }, (_, i) => ({ ...factura, id: `invoice-${i + 1}` })), next_cursor: next }).mockResolvedValueOnce(page);
    const { result } = renderHook(() => useFacturasSeguroElegibles(context), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    expect(result.current.complete).toBe(false);
    await act(async () => { await result.current.fetchNextPage(); });
    expect(state.fetch).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: next }), expect.any(AbortSignal));
    await waitFor(() => expect(result.current.items).toHaveLength(101));
    expect(result.current.complete).toBe(true);
  });

  it("deduplicates an invoice moved across page snapshots and keeps the later header without changing the cursor", async () => {
    const firstCursor = { fecha_emision: "2026-10-01", id: "invoice-b" };
    const secondCursor = { fecha_emision: "2026-09-29", id: "invoice-c" };
    state.fetch.mockResolvedValueOnce({ items: [factura, { ...factura, id: "invoice-b" }], next_cursor: firstCursor })
      .mockResolvedValueOnce({ items: [{ ...factura, proveedor_nombre: "Updated header" }, { ...factura, id: "invoice-c" }], next_cursor: secondCursor })
      .mockResolvedValueOnce({ items: [], next_cursor: null });
    const { result } = renderHook(() => useFacturasSeguroElegibles(context), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    await act(async () => { await result.current.fetchNextPage(); });
    await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual(["invoice-a", "invoice-b", "invoice-c"]));
    expect(result.current.items[0].proveedor_nombre).toBe("Updated header");
    expect(result.current.complete).toBe(false);
    expect(state.fetch).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: firstCursor }), expect.any(AbortSignal));
    await act(async () => { await result.current.fetchNextPage(); });
    expect(state.fetch).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: secondCursor }), expect.any(AbortSignal));
    await waitFor(() => expect(result.current.complete).toBe(true));
    expect(result.current.items).toHaveLength(3);
  });

  it.each([
    ["premium", { prima: "101" }], ["currency", { moneda: "USD" }], ["policy", { seguroId: "policy-b" }],
    ["shipment", { embarqueId: "shipment-b" }], ["USD FX", { tipoCambioUsd: 21 }], ["EUR FX", { tipoCambioEur: 23 }],
  ] as const)("resets pages and aborts late responses after a %s change", async (_label, change) => {
    const old = deferred(); const current = deferred();
    state.fetch.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const { result, rerender } = renderHook((props: FacturasSeguroContext) => useFacturasSeguroElegibles(props), { initialProps: context, wrapper: createWrapper() });
    const signal: AbortSignal = state.fetch.mock.calls[0][1];
    rerender({ ...context, ...change });
    expect(signal.aborted).toBe(true);
    expect(result.current.items).toEqual([]);
    await act(async () => { old.resolve(page); });
    expect(result.current.items).toEqual([]);
    await act(async () => { current.resolve({ items: [{ ...factura, id: "current" }], next_cursor: null }); });
    await waitFor(() => expect(result.current.items[0]?.id).toBe("current"));
  });

  it.each(["principal", "org", "role", "session"])("clears private pages on %s transition", async (change) => {
    const { result, rerender } = renderHook(() => useFacturasSeguroElegibles(context), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.items).toEqual(page.items));
    state.fetch.mockImplementation(() => new Promise(() => {}));
    await act(async () => {
      if (change === "principal") state.user = "user-b";
      if (change === "org") state.org = "org-b";
      if (change === "role") state.role = "viewer";
      if (change === "session") resetSessionCaches();
      rerender();
    });
    expect(result.current.items).toEqual([]);
    expect(result.current.data).toBeUndefined();
    expect(state.fetch).toHaveBeenCalledTimes(2);
  });

  it("retains loaded pages on a load-more error without declaring completeness and allows retry", async () => {
    state.fetch.mockResolvedValueOnce({ ...page, next_cursor: { fecha_emision: "2026-10-01", id: factura.id } }).mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValueOnce({ items: [], next_cursor: null });
    const { result } = renderHook(() => useFacturasSeguroElegibles(context), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(async () => { await result.current.fetchNextPage(); });
    await waitFor(() => expect(result.current.isFetchNextPageError).toBe(true));
    expect(result.current.items).toEqual(page.items);
    expect(result.current.complete).toBe(false);
    await act(async () => { await result.current.fetchNextPage(); });
    await waitFor(() => expect(result.current.complete).toBe(true));
  });

  it("dismisses, cancels late work and reopens with a new request and no stale private options", async () => {
    const old = deferred(); state.fetch.mockReturnValueOnce(old.promise).mockResolvedValueOnce(page);
    const { result, rerender } = renderHook((props: FacturasSeguroContext) => useFacturasSeguroElegibles(props), { initialProps: context, wrapper: createWrapper() });
    const signal: AbortSignal = state.fetch.mock.calls[0][1];
    rerender({ ...context, open: false });
    expect(signal.aborted).toBe(true);
    await act(async () => { old.resolve(page); });
    expect(result.current.items).toEqual([]);
    rerender(context);
    await waitFor(() => expect(result.current.items).toEqual(page.items));
    expect(state.fetch).toHaveBeenCalledTimes(2);
  });

  it("refetches on focus, hides previous results while checking and does not treat an error as an empty success", async () => {
    const fresh = deferred();
    const { result } = renderHook(() => useFacturasSeguroElegibles(context), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.items).toEqual(page.items));
    state.fetch.mockReturnValueOnce(fresh.promise);
    await act(async () => { focusManager.setFocused(false); focusManager.setFocused(true); });
    await waitFor(() => expect(result.current.isRefetching).toBe(true));
    expect(result.current.items).toEqual([]);
    await act(async () => { fresh.resolve({ items: [], next_cursor: null }); });
    await waitFor(() => expect(result.current.complete).toBe(true));
    state.fetch.mockRejectedValueOnce(new Error("Unavailable"));
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.complete).toBe(false);
    expect(result.current.items).toEqual([]);
    focusManager.setFocused(undefined);
  });

  it("does not fetch without a ready principal/org or a valid premium", () => {
    state.loading = true;
    const { result, rerender } = renderHook((props: FacturasSeguroContext) => useFacturasSeguroElegibles(props), { initialProps: context, wrapper: createWrapper() });
    expect(result.current.unavailable).toBe(true);
    state.loading = false; rerender({ ...context, prima: "NaN" });
    expect(result.current.unavailable).toBe(true);
    expect(state.fetch).not.toHaveBeenCalled();
  });
});


it("cancels a pending request when identity readiness is revoked without exposing data", async () => {
  const pending = deferred(); state.fetch.mockReturnValueOnce(pending.promise);
  const { result, rerender } = renderHook(() => useFacturasSeguroElegibles(context), { wrapper: createWrapper() });
  const signal: AbortSignal = state.fetch.mock.calls[0][1];
  state.loading = true; rerender();
  expect(signal.aborted).toBe(true);
  await act(async () => { pending.resolve(page); });
  expect(result.current.data).toBeUndefined();
  expect(result.current.items).toEqual([]);
  expect(result.current.unavailable).toBe(true);
});
