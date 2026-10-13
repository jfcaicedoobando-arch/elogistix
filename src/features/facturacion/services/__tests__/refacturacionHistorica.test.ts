import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ row: {} as Record<string, unknown>, error: null as unknown, selected: "", filters: [] as string[] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(() => {
  const query = { select: (cols: string) => { db.selected = cols; return query; }, eq: () => query,
    is: (key: string) => { db.filters.push(key); return query; }, maybeSingle: async () => ({ data: Object.fromEntries(db.selected.split(",").map(s => s.trim()).map(k => [k, db.row[k]])), error: db.error }) };
  return query;
}) } }));
import { obtenerEstadoFacturaRefacturacion } from "../refacturacion";
beforeEach(() => { db.error = null; db.filters = []; db.row = { id: "f", numero: "F1", estado: "Sustituida", uuid_fiscal: "UUID", deleted_at: "2026-10-01" }; });
describe("lectura histórica refacturación", () => {
  it("proyecta deleted_at sin ocultar folio, estado ni UUID históricos", async () => {
    expect(await obtenerEstadoFacturaRefacturacion("f")).toMatchObject(db.row);
    expect(db.filters).not.toContain("deleted_at");
  });
  it("propaga errores sin convertirlos en ausencia de referencia", async () => {
    db.error = new Error("RLS/network");
    await expect(obtenerEstadoFacturaRefacturacion("f")).rejects.toThrow("RLS/network");
  });
});
