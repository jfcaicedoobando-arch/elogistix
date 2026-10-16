import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, select, eq, maybeSingle, result } = vi.hoisted(() => ({
  from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(),
  result: { lead: { data: null, error: null } as { data: unknown; error: Error | null },
    membresia: { data: null, error: null } as { data: unknown; error: Error | null },
    oportunidades: { data: [], error: null, count: 0 } as { data: unknown[] | null; error: Error | null; count: number | null } },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
import { fetchMembresiaProspecto, fetchVinculosProspecto } from "../vinculosProspectoCrm";

beforeEach(() => {
  result.lead = { data: null, error: null };
  result.membresia = { data: null, error: null };
  result.oportunidades = { data: [], error: null, count: 0 };
  from.mockImplementation((table: string) => {
    const query = {
      select: (...args: unknown[]) => { select(...args); return query; },
      eq: (...filter: unknown[]) => {
        eq(...filter);
        return table === "crm_oportunidad_empresa" ? Promise.resolve(result.oportunidades) : query;
      },
      maybeSingle: async () => { maybeSingle(); return table === "crm_leads" ? result.lead : result.membresia; },
    };
    return query;
  });
});

describe("datos del permiso de pasar a prospecto", () => {
  it("resuelve la membresía exacta del actor en la organización activa e incluye el flag activo", async () => {
    result.membresia.data = { role: "vendedor", organization_id: "org", organizations: { activo: true } };
    expect(await fetchMembresiaProspecto("kam", "org")).toBe(result.membresia.data);
    expect(from).toHaveBeenCalledWith("organization_members");
    expect(select).toHaveBeenCalledWith("role, organization_id, organizations(activo)");
    expect(eq).toHaveBeenCalledWith("user_id", "kam");
    expect(eq).toHaveBeenCalledWith("organization_id", "org");
  });
  it("sin lead consulta únicamente vínculos, con conteo que detecta resultados truncados", async () => {
    expect(await fetchVinculosProspecto("empresa", null)).toEqual({ lead: null, oportunidades: [] });
    expect(from).toHaveBeenCalledExactlyOnceWith("crm_oportunidad_empresa");
    expect(select).toHaveBeenCalledWith(
      "organization_id, crm_oportunidades(id, organization_id, vendedor_id, deleted_at, lead_id)", { count: "exact" });
    expect(eq).toHaveBeenCalledWith("empresa_id", "empresa");
  });
  it("conserva borrados y referencias invisibles para que el guard las rechace", async () => {
    result.lead.data = { id: "lead", deleted_at: "2026-10-16", estado: "Convertido", cliente_convertido_id: "cliente" };
    result.oportunidades.data = [{ organization_id: "org", crm_oportunidades: null }];
    result.oportunidades.count = 1;
    const data = await fetchVinculosProspecto("empresa", "lead");
    expect(data).toEqual({ lead: result.lead.data, oportunidades: result.oportunidades.data });
    expect(select).toHaveBeenCalledWith("id, organization_id, vendedor_id, deleted_at, estado, cliente_convertido_id");
    expect(eq).toHaveBeenCalledWith("id", "lead");
  });
  it.each(["lead", "oportunidades"] as const)("propaga fallo de %s y no lo confunde con ausencia de vínculos", async (tipo) => {
    const error = new Error("lectura rechazada");
    result[tipo].error = error;
    await expect(fetchVinculosProspecto("empresa", "lead")).rejects.toBe(error);
  });
  it.each([null, 2])("deniega resultados incompletos o sin conteo: %s", async (count) => {
    result.oportunidades.count = count;
    await expect(fetchVinculosProspecto("empresa", null)).rejects.toThrow("todos los vínculos");
  });
});
