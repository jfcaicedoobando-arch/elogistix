import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { findProveedorByRfcEnOrg } from "../duplicadoRfc";
import { escapeIlike } from "@/lib/search/ilike";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.resetResults();
});

describe("findProveedorByRfcEnOrg — EC-03 escapeIlike", () => {
  it("escapa el RFC (con guion bajo) antes de pasarlo a .ilike", async () => {
    mock.setTableResult("proveedores", { data: null, error: null });
    await findProveedorByRfcEnOrg("ABC_10101XYZ", "org1");
    const call = mock.tableCalls.find((c) => c.table === "proveedores");
    const idx = call!.ops.indexOf("ilike");
    expect(idx).toBeGreaterThanOrEqual(0);
    const [col, pattern] = call!.opArgs[idx];
    expect(col).toBe("rfc");
    const normalizado = "ABC_10101XYZ".trim().toUpperCase();
    expect(pattern).toBe(escapeIlike(normalizado));
    expect(pattern).toContain("\\_");
  });
});
