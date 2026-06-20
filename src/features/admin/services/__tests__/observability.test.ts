/**
 * Tests para el servicio `admin/observability`: lectura de alertas, ack,
 * paginación de app_logs y health (RPCs). Mockea supabase con chain.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();
const fromMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpcMock(...a),
    from: (...a: unknown[]) => fromMock(...a),
  },
}));

import {
  fetchAlertasPendingCount,
  fetchAlertasSistema,
  reconocerAlerta,
  fetchAppLogs,
  fetchAppLogsFnList,
  fetchAppLogsHealthSummary,
  fetchAppLogsHealthTimeline,
} from "@/features/admin/services/observability";

const chainResolve = (result: { data?: unknown; error?: unknown; count?: number }) => {
  const q: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    then: (onfulfilled: (v: unknown) => unknown) => Promise.resolve(result).then(onfulfilled),
  };
  return q;
};

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
});

describe("fetchAlertasPendingCount", () => {
  it("retorna el número del RPC", async () => {
    rpcMock.mockResolvedValue({ data: 7, error: null });
    await expect(fetchAlertasPendingCount()).resolves.toBe(7);
    expect(rpcMock).toHaveBeenCalledWith("alertas_sistema_pending_count");
  });
  it("0 cuando data es null", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    await expect(fetchAlertasPendingCount()).resolves.toBe(0);
  });
  it("lanza si hay error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "no" } });
    await expect(fetchAlertasPendingCount()).rejects.toThrow();
  });
});

describe("fetchAlertasSistema", () => {
  it("filtra acknowledged_at IS NULL por defecto", async () => {
    const q = chainResolve({ data: [{ id: "a" }], error: null });
    fromMock.mockReturnValue(q);
    const out = await fetchAlertasSistema();
    expect(out).toEqual([{ id: "a" }]);
    expect(q.is).toHaveBeenCalledWith("acknowledged_at", null);
  });
  it("incluye acknowledged cuando se pide", async () => {
    const q = chainResolve({ data: [], error: null });
    fromMock.mockReturnValue(q);
    await fetchAlertasSistema(true);
    expect(q.is).not.toHaveBeenCalled();
  });
  it("lanza si error", async () => {
    fromMock.mockReturnValue(chainResolve({ data: null, error: { message: "x" } }));
    await expect(fetchAlertasSistema()).rejects.toThrow();
  });
});

describe("reconocerAlerta", () => {
  it("update + eq con id", async () => {
    const q = chainResolve({ error: null });
    fromMock.mockReturnValue(q);
    await reconocerAlerta({ id: "a-1", userId: "u-1" });
    expect(q.update).toHaveBeenCalled();
    expect(q.eq).toHaveBeenCalledWith("id", "a-1");
  });
  it("propaga error en ack", async () => {
    fromMock.mockReturnValue(chainResolve({ error: { message: "no" } }));
    await expect(reconocerAlerta({ id: "a", userId: null })).rejects.toThrow();
  });
});

describe("fetchAppLogs", () => {
  it("aplica filtros y paginación", async () => {
    const q = chainResolve({ data: [{ id: 1 }], error: null, count: 42 });
    fromMock.mockReturnValue(q);
    const out = await fetchAppLogs({
      page: 2,
      pageSize: 25,
      level: "error",
      fn: "miFn",
      search: "  fallo  ",
      from: "2026-01-01",
      to: "2026-01-31",
    });
    expect(out).toEqual({ rows: [{ id: 1 }], total: 42 });
    expect(q.eq).toHaveBeenCalledWith("level", "error");
    expect(q.eq).toHaveBeenCalledWith("fn", "miFn");
    expect(q.ilike).toHaveBeenCalledWith("msg", "%fallo%");
    expect(q.gte).toHaveBeenCalledWith("ts", "2026-01-01T00:00:00.000Z");
    expect(q.lte).toHaveBeenCalledWith("ts", "2026-01-31T23:59:59.999Z");
    // page 2 con pageSize 25 → range(25, 49)
    expect(q.range).toHaveBeenCalledWith(25, 49);
  });
  it("omite filtros cuando son 'todos' o vacíos", async () => {
    const q = chainResolve({ data: [], error: null, count: 0 });
    fromMock.mockReturnValue(q);
    await fetchAppLogs({ page: 1, pageSize: 50, level: "todos", fn: "todos", search: "", from: null, to: null });
    expect(q.eq).not.toHaveBeenCalled();
    expect(q.ilike).not.toHaveBeenCalled();
    expect(q.gte).not.toHaveBeenCalled();
    expect(q.lte).not.toHaveBeenCalled();
  });
  it("propaga error con mensaje", async () => {
    fromMock.mockReturnValue(chainResolve({ data: null, error: { message: "boom" }, count: 0 }));
    await expect(
      fetchAppLogs({ page: 1, pageSize: 50, level: "todos", fn: "todos", search: "", from: null, to: null }),
    ).rejects.toThrow("boom");
  });
});

describe("fetchAppLogsFnList", () => {
  it("dedup + sort ascendente", async () => {
    fromMock.mockReturnValue(
      chainResolve({ data: [{ fn: "b" }, { fn: "a" }, { fn: "b" }, { fn: "c" }], error: null }),
    );
    await expect(fetchAppLogsFnList()).resolves.toEqual(["a", "b", "c"]);
  });
  it("lanza con mensaje en error", async () => {
    fromMock.mockReturnValue(chainResolve({ data: null, error: { message: "x" } }));
    await expect(fetchAppLogsFnList()).rejects.toThrow("x");
  });
});

describe("fetchAppLogsHealthSummary", () => {
  it("mapea numbers y conserva nulls", async () => {
    rpcMock.mockResolvedValue({
      data: [
        { fn: "a", total: "10", errors: "1", warns: 0, p50_ms: "5", p95_ms: null, last_ts: "t", last_error_ts: null },
      ],
      error: null,
    });
    const out = await fetchAppLogsHealthSummary(24);
    expect(out[0]).toEqual({
      fn: "a", total: 10, errors: 1, warns: 0, p50_ms: 5, p95_ms: null, last_ts: "t", last_error_ts: null,
    });
    expect(rpcMock).toHaveBeenCalledWith("app_logs_health_summary", { p_hours: 24 });
  });
  it("propaga error en health summary", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "y" } });
    await expect(fetchAppLogsHealthSummary(1)).rejects.toThrow("y");
  });
});

describe("fetchAppLogsHealthTimeline", () => {
  it("mapea points y default buckets=24", async () => {
    rpcMock.mockResolvedValue({
      data: [{ bucket: "b1", total: "3", errors: "1", warns: "0" }],
      error: null,
    });
    const out = await fetchAppLogsHealthTimeline(12);
    expect(out).toEqual([{ bucket: "b1", total: 3, errors: 1, warns: 0 }]);
    expect(rpcMock).toHaveBeenCalledWith("app_logs_health_timeline", { p_hours: 12, p_buckets: 24 });
  });
});
