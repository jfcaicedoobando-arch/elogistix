import { describe, it, expect, beforeEach, vi } from "vitest";

// 13.85.8 — Migrado al helper canónico `createSupabaseMock`. Se envuelve cada
// resultado en `{ data, error, count }` porque los servicios usan el conteo
// de filas devuelto por Supabase para los dashboards de admin.
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  fetchAdminOrgActivity,
  fetchAdminRecentOrgs,
  fetchAdminDashboardStats,
  countOrgMembers,
  countOrgEmbarques,
  countOrgClientes,
  countOrgCotizaciones,
} from "@/features/admin/services/stats";

type TableArg = { data: unknown; count?: number; error: unknown };
const setTable = (t: string, r: TableArg) =>
  mock.setTableResult(t, { data: r.data, error: r.error, count: r.count ?? null } as never);
const setRpc = (name: string, r: { data: unknown; error: unknown }) =>
  mock.setRpcResult(name, r);

beforeEach(() => {
  // Reset por test: evita arrastrar `count`/`data` configurados en el anterior.
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
});

describe("services/admin/stats", () => {
  it("fetchAdminOrgActivity agrega conteos por org", async () => {
    mock.setRpc("fn_admin_org_activity", {
      data: [
        { id: "o1", nombre: "A", embarques: 2, cotizaciones: 1 },
        { id: "o2", nombre: "B", embarques: 1, cotizaciones: 0 },
      ],
      error: null,
    });
    const r = await fetchAdminOrgActivity();
    expect(r).toHaveLength(2);
    const o1 = r.find((x) => x.id === "o1")!;
    expect(o1.embarques).toBe(2);
    expect(o1.cotizaciones).toBe(1);
  });

  it("fetchAdminOrgActivity ignora filas sin organization_id", async () => {
    mock.setRpc("fn_admin_org_activity", {
      data: [{ id: "o1", nombre: "A", embarques: 1, cotizaciones: 0 }],
      error: null,
    });
    const r = await fetchAdminOrgActivity();
    expect(r[0].embarques).toBe(1);
  });


  it("fetchAdminRecentOrgs devuelve filas", async () => {
    mock.setTable("organizations", {
      data: [{ id: "o1", nombre: "A", plan: "pro", created_at: "2026-01-01" }],
      error: null,
    });
    const r = await fetchAdminRecentOrgs(3);
    expect(r).toHaveLength(1);
    expect(r[0].plan).toBe("pro");
  });

  it("fetchAdminRecentOrgs propaga error", async () => {
    mock.setTable("organizations", { data: null, error: { message: "x" } });
    await expect(fetchAdminRecentOrgs()).rejects.toThrow();
  });

  it("fetchAdminDashboardStats devuelve totales", async () => {
    mock.setTable("organizations", { data: null, count: 5, error: null });
    mock.setTable("organization_members", { data: null, count: 20, error: null });
    mock.setTable("embarques", { data: null, count: 100, error: null });
    mock.setTable("cotizaciones", { data: null, count: 50, error: null });
    const r = await fetchAdminDashboardStats();
    expect(r).toEqual({ totalOrgs: 5, totalUsers: 20, totalEmbarques: 100, totalCotizaciones: 50 });
  });

  it("fetchAdminDashboardStats trata count null como 0", async () => {
    mock.setTable("organizations", { data: null, error: null });
    mock.setTable("organization_members", { data: null, error: null });
    mock.setTable("embarques", { data: null, error: null });
    mock.setTable("cotizaciones", { data: null, error: null });
    const r = await fetchAdminDashboardStats();
    expect(r.totalOrgs).toBe(0);
  });

  it("countOrgMembers devuelve count", async () => {
    mock.setTable("organization_members", { data: null, count: 7, error: null });
    expect(await countOrgMembers("o1")).toBe(7);
  });

  it("countOrgEmbarques devuelve count", async () => {
    mock.setTable("embarques", { data: null, count: 12, error: null });
    expect(await countOrgEmbarques("o1")).toBe(12);
  });

  it("countOrgClientes devuelve count", async () => {
    mock.setTable("clientes", { data: null, count: 3, error: null });
    expect(await countOrgClientes("o1")).toBe(3);
  });

  it("countOrgCotizaciones devuelve count", async () => {
    mock.setTable("cotizaciones", { data: null, count: 9, error: null });
    expect(await countOrgCotizaciones("o1")).toBe(9);
  });

  it("countByOrg propaga error", async () => {
    mock.setTable("organization_members", { data: null, error: { message: "x" } });
    await expect(countOrgMembers("o1")).rejects.toThrow();
  });
});
