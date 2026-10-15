import { describe, expect, it, vi } from "vitest";
const consulta = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), limit: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: consulta.from } }));
import { fetchOportunidadesEmpresaEliminada, oportunidadesConEmpresaEliminada } from "../empresaEliminadaCrm";

describe("oportunidadesConEmpresaEliminada", () => {
  it("marca la oportunidad cuya única empresa fue eliminada", () => {
    expect(oportunidadesConEmpresaEliminada([{ oportunidad_id: "o1", eliminada: true }]).has("o1")).toBe(true);
  });
  it("no marca si todavía tiene otra empresa activa", () => {
    const r = oportunidadesConEmpresaEliminada([
      { oportunidad_id: "o1", eliminada: true }, { oportunidad_id: "o1", eliminada: false },
    ]);
    expect(r.has("o1")).toBe(false);
  });
  it("no marca oportunidades con empresa activa", () => {
    expect(oportunidadesConEmpresaEliminada([{ oportunidad_id: "o2", eliminada: false }]).size).toBe(0);
  });
});

describe("lectura tipada de empresas vinculadas", () => {
  it("sólo marca oportunidades con todos sus vínculos eliminados", async () => {
    consulta.from.mockReturnValue(consulta); consulta.select.mockReturnValue(consulta);
    consulta.limit.mockResolvedValue({ data: [
      { oportunidad_id: "mixta", crm_empresas: { deleted_at: "2026-10-14" } },
      { oportunidad_id: "mixta", crm_empresas: { deleted_at: null } },
      { oportunidad_id: "eliminadas", crm_empresas: { deleted_at: "2026-10-14" } },
      { oportunidad_id: "eliminadas", crm_empresas: { deleted_at: "2026-10-13" } },
      { oportunidad_id: "sin-empresa", crm_empresas: null },
    ], error: null });
    expect(await fetchOportunidadesEmpresaEliminada()).toEqual(new Set(["eliminadas"]));
    expect(consulta.from).toHaveBeenCalledWith("crm_oportunidad_empresa");
    expect(consulta.select).toHaveBeenCalledWith("oportunidad_id, crm_empresas!inner(deleted_at)");
  });
  it("propaga errores y no convierte un fallo en ausencia de empresas eliminadas", async () => {
    consulta.from.mockReturnValue(consulta); consulta.select.mockReturnValue(consulta);
    const error = new Error("lectura rechazada");
    consulta.limit.mockResolvedValue({ data: null, error });
    await expect(fetchOportunidadesEmpresaEliminada()).rejects.toBe(error);
  });
  it("una lectura vacía no marca oportunidades", async () => {
    consulta.from.mockReturnValue(consulta); consulta.select.mockReturnValue(consulta);
    consulta.limit.mockResolvedValue({ data: null, error: null });
    expect(await fetchOportunidadesEmpresaEliminada()).toEqual(new Set());
  });
});
