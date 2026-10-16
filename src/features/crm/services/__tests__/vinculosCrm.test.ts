import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, select, eq, limit } = vi.hoisted(() => ({
  from: vi.fn(), select: vi.fn(), eq: vi.fn(), limit: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
import { empresasDeContacto, empresasDeOportunidad } from "../vinculosCrm";

beforeEach(() => {
  vi.clearAllMocks();
  from.mockReturnValue({ select });
  select.mockReturnValue({ eq });
  eq.mockReturnValue({ limit });
});

describe.each([
  { leer: empresasDeContacto, tabla: "crm_empresa_contacto", columna: "contacto_id" },
  { leer: empresasDeOportunidad, tabla: "crm_oportunidad_empresa", columna: "oportunidad_id" },
])("empresas vinculadas desde $tabla", ({ leer, tabla, columna }) => {
  it("conserva id/nombre e historial y proyecta el estado sin devolver la fecha", async () => {
    const filas = [
      { crm_empresas: { id: "activa", nombre: "Zeta", deleted_at: null } },
      { crm_empresas: null },
      { crm_empresas: { id: "eliminada", nombre: "Alfa", deleted_at: "2026-10-16T10:00:00Z" } },
    ];
    const original = structuredClone(filas);
    limit.mockResolvedValue({ data: filas, error: null });

    expect(await leer("dueno")).toEqual([
      { id: "eliminada", nombre: "Alfa", empresaEliminada: true },
      { id: "activa", nombre: "Zeta", empresaEliminada: false },
    ]);
    expect(filas).toEqual(original);
    expect(from).toHaveBeenCalledExactlyOnceWith(tabla);
    expect(select).toHaveBeenCalledExactlyOnceWith("crm_empresas(id, nombre, deleted_at)");
    expect(eq).toHaveBeenCalledExactlyOnceWith(columna, "dueno");
    expect(limit).toHaveBeenCalledExactlyOnceWith(200);
  });

  it.each([{ data: null }, { data: [] }, { data: [{ crm_empresas: null }] }])("no inventa una empresa para datos vacíos u ocultos: %j", async ({ data }) => {
    limit.mockResolvedValue({ data, error: null });
    expect(await leer("dueno")).toEqual([]);
  });

  it("propaga los errores de lectura", async () => {
    const error = new Error("lectura rechazada");
    limit.mockResolvedValue({ data: null, error });
    await expect(leer("dueno")).rejects.toBe(error);
  });
});
