import { describe, it, expect, beforeEach, vi } from "vitest";

// Custom mock: por-tabla devolvemos data y count separados.
const mock = await vi.hoisted(() => {
  const tableResults = new Map<string, { data: unknown; count?: number; error: unknown }>();
  const setTable = (t: string, r: { data: unknown; count?: number; error: unknown }) => tableResults.set(t, r);
  const clear = () => tableResults.clear();
  const supabase = {
    from: (table: string) => {
      const res = tableResults.get(table) ?? { data: [], error: null };
      const chain: Record<string, unknown> = {};
      const pass = () => chain;
      chain.select = pass;
      chain.eq = pass;
      chain.order = pass;
      chain.limit = pass;
      chain.then = (cb: (r: unknown) => unknown) =>
        Promise.resolve({ data: res.data, error: res.error, count: res.count ?? null }).then(cb);
      return chain;
    },
  };
  return { supabase, setTable, clear };
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
} from "@/services/admin/stats";

beforeEach(() => {
  // Reset por test: evita arrastrar `count`/`data` configurados en el anterior.
  mock.clear();
});

describe("services/admin/stats", () => {
  it("fetchAdminOrgActivity agrega conteos por org", async () => {
    mock.setTable("organizations", { data: [{ id: "o1", nombre: "A" }, { id: "o2", nombre: "B" }], error: null });
    mock.setTable("embarques", { data: [{ organization_id: "o1" }, { organization_id: "o1" }, { organization_id: "o2" }], error: null });
    mock.setTable("cotizaciones", { data: [{ organization_id: "o1" }], error: null });
    const r = await fetchAdminOrgActivity();
    expect(r).toHaveLength(2);
    const o1 = r.find((x) => x.id === "o1")!;
    expect(o1.embarques).toBe(2);
    expect(o1.cotizaciones).toBe(1);
  });

  it("fetchAdminOrgActivity ignora filas sin organization_id", async () => {
    mock.setTable("organizations", { data: [{ id: "o1", nombre: "A" }], error: null });
    mock.setTable("embarques", { data: [{ organization_id: null }, { organization_id: "o1" }], error: null });
    mock.setTable("cotizaciones", { data: [], error: null });
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
