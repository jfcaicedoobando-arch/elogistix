/**
 * `listLeads` (services/crm/leads/queries) — contrato de orden y filtros
 * server-side. Cubre Ola 2 del plan de filtros globales.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listLeads } from "@/features/crm/services/leads/queries";

// Mock del cliente Supabase con thenable chain.
const state: {
  order: [string, { ascending: boolean }] | null;
  ors: string[];
  eqs: Array<[string, string]>;
  range: [number, number] | null;
} = { order: null, ors: [], eqs: [], range: null };

const builder: Record<string, unknown> = {
  select: vi.fn().mockReturnThis(),
  order: vi.fn((col: string, opts: { ascending: boolean }) => {
    state.order = [col, opts];
    return builder;
  }),
  or: vi.fn((v: string) => {
    state.ors.push(v);
    return builder;
  }),
  eq: vi.fn((col: string, v: string) => {
    state.eqs.push([col, v]);
    return builder;
  }),
  range: vi.fn((from: number, to: number) => {
    state.range = [from, to];
    return Promise.resolve({ data: [], count: 0, error: null });
  }),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(() => builder) },
}));

beforeEach(() => {
  state.order = null;
  state.ors = [];
  state.eqs = [];
  state.range = null;
});

describe("listLeads — contrato server-side", () => {
  it("aplica orden por default created_at desc y range de la página", async () => {
    await listLeads({ page: 0, pageSize: 25 });
    expect(state.order).toEqual(["created_at", { ascending: false }]);
    expect(state.range).toEqual([0, 24]);
  });

  it("respeta sortKey/sortDir y calcula range para páginas siguientes", async () => {
    await listLeads({ page: 2, pageSize: 10, sortKey: "empresa", sortDir: "asc" });
    expect(state.order).toEqual(["empresa", { ascending: true }]);
    expect(state.range).toEqual([20, 29]);
  });

  it("aplica filtros de estado y fuente cuando no son 'todos'", async () => {
    await listLeads({ estado: "Calificado", fuente: "Web" });
    expect(state.eqs).toContainEqual(["estado", "Calificado"]);
    expect(state.eqs).toContainEqual(["fuente", "Web"]);
  });

  it("omite eq() cuando estado/fuente son 'todos'", async () => {
    await listLeads({ estado: "todos", fuente: "todos" });
    expect(state.eqs).toEqual([]);
  });

  it("aplica búsqueda como or() sobre empresa/contacto/email", async () => {
    await listLeads({ search: "acme" });
    expect(state.ors).toHaveLength(1);
    expect(state.ors[0]).toContain("empresa.ilike.%acme%");
    expect(state.ors[0]).toContain("contacto.ilike.%acme%");
    expect(state.ors[0]).toContain("email.ilike.%acme%");
  });
});
