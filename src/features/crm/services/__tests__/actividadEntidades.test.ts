import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CrmActividadRow } from "../actividades";
import { adjuntarEntidadesActividad, listActividadesAgenda } from "../actividadEntidades";
import { actividadEntidadHref, actividadEntidadNombre } from "../../domain/actividadEntidad";

const mocks = vi.hoisted(() => ({ from: vi.fn(), list: vi.fn(), calls: [] as { table: string; ids: string[] }[], fail: "" }));
vi.mock("../actividades", () => ({ listActividades: mocks.list }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

function actividad(id: string, tipo: CrmActividadRow["entidad_tipo"], entidad: string): CrmActividadRow {
  return { id, entidad_tipo: tipo, entidad_id: entidad, asunto: "Seguimiento Shanghai–Manzanillo" } as CrmActividadRow;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.calls = [];
  mocks.fail = "";
  mocks.from.mockImplementation((table: string) => {
    let ids: string[] = [];
    return { select: (projection: string) => {
      expect(projection).toBe(table === "crm_leads" ? "id, empresa" : "id, nombre");
      return { in: (key: string, values: string[]) => {
        expect(key).toBe("id");
        ids = values;
        mocks.calls.push({ table, ids });
        return { is: async (key: string, value: unknown) => {
          expect([key, value]).toEqual(["deleted_at", null]);
          if (mocks.fail === table) return { data: null, error: new Error("Network unavailable") };
          const data = ids.filter(id => id !== "missing").map(id => table === "crm_leads"
            ? { id, empresa: "Empaques Regios" } : { id, nombre: "Importación de resinas Ningbo–Altamira" });
          return { data, error: null };
        } };
      } };
    } };
  });
});

describe("nombres de entidades de la agenda", () => {
  it("consulta por tipo y deduplica sin alterar orden, cantidad ni las filas originales", async () => {
    const rows = [actividad("a1", "lead", "l1"), actividad("a2", "oportunidad", "o1"), actividad("a3", "lead", "l1")];
    const result = await adjuntarEntidadesActividad(rows);
    expect(mocks.calls).toEqual([{ table: "crm_leads", ids: ["l1"] }, { table: "crm_oportunidades", ids: ["o1"] }]);
    expect(result.map(a => a.id)).toEqual(["a1", "a2", "a3"]);
    expect(result[0]).toMatchObject({ entidad_nombre: "Empaques Regios", entidad_estado: "disponible" });
    expect(actividadEntidadHref(result[1])).toBe("/crm/oportunidades/o1");
    expect(rows[0].entidad_nombre).toBeUndefined();
  });

  it("parte más de 100 entidades únicas sin consultas vacías", async () => {
    await adjuntarEntidadesActividad(Array.from({ length: 205 }, (_, i) => actividad(`a${i}`, "lead", `l${i}`)));
    expect(mocks.calls.map(c => c.ids.length)).toEqual([100, 100, 5]);
    mocks.from.mockClear();
    expect(await adjuntarEntidadesActividad([])).toEqual([]);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("distingue error de lectura de entidad ausente y conserva el resto de la agenda", async () => {
    mocks.fail = "crm_leads";
    const result = await adjuntarEntidadesActividad([actividad("a1", "lead", "l1"), actividad("a2", "oportunidad", "missing"), actividad("a3", "oportunidad", "o1")]);
    expect(result.map(a => a.entidad_estado)).toEqual(["error", "no_disponible", "disponible"]);
    expect(actividadEntidadNombre(result[0])).toBe("No pudimos consultar la entidad");
    expect(actividadEntidadNombre(result[1])).toBe("Entidad no disponible");
    expect(result.map(actividadEntidadHref)).toEqual([null, null, "/crm/oportunidades/o1"]);
  });

  it("no inventa enlaces ni consultas para clientes/contactos históricos", async () => {
    const rows = [actividad("a1", "cliente", "c1"), actividad("a2", "contacto", "c2")];
    expect(await adjuntarEntidadesActividad(rows)).toEqual(rows);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(actividadEntidadHref({ ...rows[0], entidad_estado: "disponible" })).toBeNull();
  });

  it("preserva la paginación y el conteo del servidor en la consulta específica de agenda", async () => {
    const params = { search: "resinas", tipo: "todos" as const, estado: "pendientes" as const, responsable: "todos" as const, page: 2, pageSize: 25 };
    mocks.list.mockResolvedValue({ data: [actividad("a1", "lead", "l1")], count: 98 });
    const result = await listActividadesAgenda(params);
    expect(mocks.list).toHaveBeenCalledWith(params);
    expect(result.count).toBe(98);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].entidad_nombre).toBe("Empaques Regios");
  });

  it("codifica el ID y ofrece texto explícito si no hay nombre", () => {
    expect(actividadEntidadHref({ entidad_tipo: "lead", entidad_id: "id/con espacio", entidad_estado: "disponible" })).toBe("/crm/leads/id%2Fcon%20espacio");
    expect(actividadEntidadNombre({ entidad_nombre: "  " })).toBe("Sin nombre disponible");
    expect(actividadEntidadHref(actividad("a1", "lead", "l1"))).toBeNull();
  });
});
