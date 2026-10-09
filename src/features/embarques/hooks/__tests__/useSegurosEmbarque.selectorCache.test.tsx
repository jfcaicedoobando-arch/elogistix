import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearCacheSeguroFactura } from "@/test/helpers/seguroFacturaCache";
import type { SeguroEmbarqueInput } from "../../services/seguros";

const svc = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), remove: vi.fn(), success: vi.fn() }));
vi.mock("@/features/embarques/services/seguros", () => ({
  createSeguroEmbarque: svc.create, updateSeguroEmbarque: svc.update,
  deleteSeguroEmbarque: svc.remove, fetchSegurosEmbarque: vi.fn(),
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: svc.success, notifyError: vi.fn() }));
import { useCreateSeguro, useUpdateSeguro, useDeleteSeguro } from "../useSegurosEmbarque";

let cache = crearCacheSeguroFactura();
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cache.client}>{children}</QueryClientProvider>;
const input: SeguroEmbarqueInput = {
  embarque_id: "embarque-a", aseguradora: "Synthetic insurer", numero_poliza: "POL-1",
  certificado_url: null, cobertura_descripcion: null, suma_asegurada: 1000,
  deducible: 0, prima: 100, moneda: "MXN", vigencia_desde: "2026-01-01", vigencia_hasta: "2026-12-31",
  contacto: null, notas: null, proveedor_factura_id: "factura-a",
};
beforeEach(() => {
  svc.create.mockReset().mockResolvedValue({ id: "policy-a" });
  svc.update.mockReset().mockResolvedValue(undefined);
  svc.remove.mockReset().mockResolvedValue(undefined);
  svc.success.mockClear();
});
afterEach(() => { cache.client.clear(); cache = crearCacheSeguroFactura(); });

function useMutations() {
  return { create: useCreateSeguro("embarque-a"), update: useUpdateSeguro("embarque-a"), remove: useDeleteSeguro("embarque-a") };
}
function execute(mutations: ReturnType<typeof useMutations>, operation: "create" | "update" | "remove") {
  if (operation === "create") return mutations.create.mutateAsync(input);
  if (operation === "update") return mutations.update.mutateAsync({ id: "policy-a", patch: { proveedor_factura_id: null } });
  return mutations.remove.mutateAsync("policy-a");
}

describe("global invoice occupancy cache after insurance mutations", () => {
  it.each(["create", "update", "remove"] as const)("%s invalidates both cached shipments and leaves unrelated families/data intact", async (operation) => {
    const before = cache.client.getQueryCache().getAll().map((query) => [query.queryHash, query.state.data]);
    const { result } = renderHook(useMutations, { wrapper });
    await act(async () => { await execute(result.current, operation); });
    for (const key of cache.afectadas) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(true);
    for (const key of cache.ajenas) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(false);
    expect(cache.client.getQueryCache().getAll().map((query) => [query.queryHash, query.state.data])).toEqual(before);
    expect(svc[operation]).toHaveBeenCalledOnce();
    expect(svc.success).toHaveBeenCalledOnce();
  });

  it.each(["create", "update", "remove"] as const)("rejected %s does not alter any cache or announce success", async (operation) => {
    svc[operation].mockRejectedValue(new Error("LC_CONFLICTO_CONCURRENCIA"));
    const { result } = renderHook(useMutations, { wrapper });
    await act(async () => { await expect(execute(result.current, operation)).rejects.toThrow("LC_CONFLICTO_CONCURRENCIA"); });
    for (const key of [...cache.afectadas, ...cache.ajenas]) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(false);
    expect(svc.success).not.toHaveBeenCalled();
  });
});
