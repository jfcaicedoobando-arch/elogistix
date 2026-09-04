/**
 * Regresión EC-15: searchCrm debe buscar leads por empresa, contacto y email.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const orCalls: string[] = [];

vi.mock("@/integrations/supabase/client", () => {
  const build = (table: string) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.select = self;
    chain.ilike = self;
    chain.limit = () => Promise.resolve({ data: [], error: null });
    chain.is = self;
    chain.or = (expr: string) => {
      if (table === "crm_leads") orCalls.push(expr);
      return chain;
    };
    return chain;
  };
  return { supabase: { from: (table: string) => build(table) } };
});

import { searchCrm } from "../search";

describe("searchCrm — leads", () => {
  beforeEach(() => {
    orCalls.length = 0;
  });

  it("filtra por empresa, contacto y email", async () => {
    await searchCrm("qa@example.test");
    expect(orCalls).toHaveLength(1);
    expect(orCalls[0]).toContain("empresa.ilike");
    expect(orCalls[0]).toContain("contacto.ilike");
    expect(orCalls[0]).toContain("email.ilike");
  });
});
