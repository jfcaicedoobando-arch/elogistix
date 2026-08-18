import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/features/crm/services/etapas", () => ({ fetchEtapasPipelineActivas: vi.fn() }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn() }));

import { findLeadIdByEmail } from "../helpers";
import { escapeIlike } from "@/lib/search/ilike";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.resetResults();
});

describe("findLeadIdByEmail — EC-03 escapeIlike", () => {
  it("escapa el guion bajo del correo antes de pasarlo a .ilike (no es comodín)", async () => {
    mock.setTableResult("crm_leads", { data: null, error: null });
    await findLeadIdByEmail("juan_perez@x.com");
    const call = mock.tableCalls.find((c) => c.table === "crm_leads");
    const idx = call!.ops.indexOf("ilike");
    expect(idx).toBeGreaterThanOrEqual(0);
    const [col, pattern] = call!.opArgs[idx];
    expect(col).toBe("email");
    expect(pattern).toBe(escapeIlike("juan_perez@x.com"));
    expect(pattern).toContain("\\_");
  });
});
