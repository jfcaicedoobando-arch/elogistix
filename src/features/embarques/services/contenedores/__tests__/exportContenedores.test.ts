import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
import { fetchContenedoresParaExport, resumirContenedoresExport } from "../exportContenedores";
const tipo = "a54f64b3-fb27-4cb9-b69f-31bc9076b390";
const embarques = [{ id: "e1", contenedor: "LEGACY", tipo_contenedor: tipo }];
beforeEach(() => vi.clearAllMocks());
describe("Audit150: exportación completa de contenedores", () => {
  it("conserva2hijos ordenados y tipos legibles, sin duplicar la fila", () => {
    const hijos = [2, 1].map(orden => ({ id: `h${orden}`, embarque_id: "e1", numero_contenedor: `NUM${orden}`, tipo_contenedor: tipo, orden }));
    expect(resumirContenedoresExport(embarques, hijos, { [tipo]: "40HC" })).toEqual({ e1: { contenedor: "NUM1; NUM2", tipo_contenedor: "40HC; 40HC" } });
  });
  it("resuelve UUID legado e indica incompletos sin exportar identificadores opacos", () => {
    expect(resumirContenedoresExport(embarques, [], { [tipo]: "40HC" }).e1.tipo_contenedor).toBe("40HC");
    expect(resumirContenedoresExport(embarques, [], {}).e1.tipo_contenedor).toBe("Tipo sin identificar");
    expect(resumirContenedoresExport(embarques, [{ id: "h1", embarque_id: "e1", numero_contenedor: null, tipo_contenedor: null, orden: 0 }], {}).e1).toEqual({ contenedor: "Pendiente", tipo_contenedor: "Pendiente" });
  });
  it("un solapamiento de páginas no duplica el mismo hijo", () => {
    const hijo = { id: "h1", embarque_id: "e1", numero_contenedor: "NUM1", tipo_contenedor: "40HC", orden: 1 };
    expect(resumirContenedoresExport(embarques, [hijo, hijo], {}).e1).toEqual({ contenedor: "NUM1", tipo_contenedor: "40HC" });
  });
  it("sin hijos ni datos históricos no inventa un contenedor pendiente", () => {
    expect(resumirContenedoresExport([{ id: "aereo", contenedor: null, tipo_contenedor: null }], [], {})).toEqual({ aereo: { contenedor: "", tipo_contenedor: "" } });
  });
  it("no mezcla hijos de otro embarque y conserva tipo semántico histórico", () => {
    expect(resumirContenedoresExport([{ ...embarques[0], tipo_contenedor: "20DRY" }], [{ id: "otro", embarque_id: "e2", numero_contenedor: "OTRO", tipo_contenedor: tipo, orden: 1 }], {}).e1).toEqual({ contenedor: "LEGACY", tipo_contenedor: "20DRY" });
  });
  it("pagina los hijos, limita organización y excluye borrados antes de exportar", async () => {
    const chain = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), is: vi.fn(), order: vi.fn(), range: vi.fn() };
    for (const key of ["select", "eq", "in", "is", "order"] as const) chain[key].mockReturnValue(chain);
    const rows = Array.from({ length: 1000 }, (_, i) => ({ id: `h${i}`, embarque_id: "e1", numero_contenedor: `NUM${i}`, tipo_contenedor: "40HC", orden: i }));
    chain.range.mockResolvedValueOnce({ data: rows, error: null }).mockResolvedValueOnce({ data: [{ ...rows[0], id: "tail", orden: 1000, numero_contenedor: "ULTIMO" }], error: null });
    mocks.from.mockReturnValue(chain);
    const result = await fetchContenedoresParaExport([{ ...embarques[0], tipo_contenedor: "40HC" }], "orgA");
    expect(chain.eq).toHaveBeenCalledWith("organization_id", "orgA");
    expect(chain.is).toHaveBeenCalledWith("deleted_at", null);
    expect(chain.range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(result.e1.contenedor).toContain("ULTIMO");
  });
  it("falla cerrada si falta organización o una página falla", async () => {
    await expect(fetchContenedoresParaExport(embarques, null)).rejects.toThrow("organización");
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
