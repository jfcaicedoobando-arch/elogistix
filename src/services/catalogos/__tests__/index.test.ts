import { describe, it, expect, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchNavieras, fetchPuertos } from "../index";

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("catalogos/index", () => {
  it("fetchNavieras consulta la tabla navieras ordenada", async () => {
    mock.setTableResult("navieras", { data: [{ name: "MSC" }], error: null });
    const result = await fetchNavieras();
    const call = mock.tableCalls.find((c) => c.table === "navieras");
    expect(call?.ops).toContain("select");
    expect(call?.ops).toContain("order");
    expect(result[0].name).toBe("MSC");
  });

  it("fetchPuertos consulta la tabla puertos", async () => {
    mock.setTableResult("puertos", { data: [{ name: "Manzanillo" }], error: null });
    await fetchPuertos();
    expect(mock.tableCalls.some((c) => c.table === "puertos")).toBe(true);
  });
});
