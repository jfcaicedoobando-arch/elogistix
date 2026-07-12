/**
 * Tests focalizados para las factories `queryOptions()` centralizadas del dominio
 * embarques. Verifica queryKey, staleTime y que queryFn delegue al servicio.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/features/embarques/services", () => ({
  fetchEmbarquesPaginados: vi.fn(async () => ({ rows: [], count: 0 })),
  fetchEmbarqueById: vi.fn(async () => ({ id: "e1" })),
  fetchEmbarqueConceptosVenta: vi.fn(async () => []),
  fetchEmbarqueConceptosCosto: vi.fn(async () => []),
  fetchExpedientesCliente: vi.fn(async () => []),
  fetchProveedoresForSelect: vi.fn(async () => []),
}));

import { embarqueQueries } from "@/features/embarques/queries";
import { staleTimes } from "@/lib/query/staleTimes";
import { queryKeys } from "@/lib/query";
import * as svc from "@/features/embarques/services";

const filters = { page: 1, pageSize: 20, search: "" } as never;

describe("embarqueQueries factories", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list: queryKey + staleTime MEDIUM + delega en fetchEmbarquesPaginados", async () => {
    const opts = embarqueQueries.list(filters);
    expect(opts.queryKey).toEqual(
      queryKeys.embarques.list(filters as unknown as Record<string, unknown>),
    );
    expect(opts.staleTime).toBe(staleTimes.MEDIUM);
    await (opts.queryFn as () => Promise<unknown>)();
    expect(svc.fetchEmbarquesPaginados).toHaveBeenCalledWith(filters);
  });

  it("detail: staleTime SHORT y llama a fetchEmbarqueById(id)", async () => {
    const opts = embarqueQueries.detail("emb-1");
    expect(opts.queryKey).toEqual(queryKeys.embarques.detail("emb-1"));
    expect(opts.staleTime).toBe(staleTimes.SHORT);
    await (opts.queryFn as () => Promise<unknown>)();
    expect(svc.fetchEmbarqueById).toHaveBeenCalledWith("emb-1");
  });

  it("conceptosVenta y conceptosCosto usan SHORT y sus servicios", async () => {
    const v = embarqueQueries.conceptosVenta("emb-1");
    const c = embarqueQueries.conceptosCosto("emb-1");
    expect(v.staleTime).toBe(staleTimes.SHORT);
    expect(c.staleTime).toBe(staleTimes.SHORT);
    await (v.queryFn as () => Promise<unknown>)();
    await (c.queryFn as () => Promise<unknown>)();
    expect(svc.fetchEmbarqueConceptosVenta).toHaveBeenCalledWith("emb-1");
    expect(svc.fetchEmbarqueConceptosCosto).toHaveBeenCalledWith("emb-1");
  });

  it("expedientesCliente: MEDIUM y clave incluye organizationId", () => {
    const opts = embarqueQueries.expedientesCliente("cli-1", "org-7");
    expect(opts.queryKey).toEqual(
      queryKeys.embarques.expedientesCliente("cli-1", "org-7"),
    );
    expect(opts.staleTime).toBe(staleTimes.MEDIUM);
  });

  it("proveedoresSelect: LONG y normaliza organizationId null", async () => {
    const opts = embarqueQueries.proveedoresSelect(undefined);
    expect(opts.staleTime).toBe(staleTimes.LONG);
    await (opts.queryFn as () => Promise<unknown>)();
    expect(svc.fetchProveedoresForSelect).toHaveBeenCalledWith(null);
  });
});
