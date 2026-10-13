import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHistoricalReadMock, type HistoricalRow } from "@/test/helpers/historicalReadMock";
import { toCSV } from "@/lib/io/csv";

const h = vi.hoisted(() => ({
  current: null as ReturnType<typeof createHistoricalReadMock> | null,
  download: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/integrations/supabase/client", () => ({ get supabase() { return h.current!.supabase; } }));
// Keep the real serializer in the end-to-end extraction; only the browser download is replaced.
vi.mock("@/lib/io", async () => ({ ...await import("@/lib/io/csv"), downloadZip: h.download }));
import { EXPORT_GROUPS, EXPORT_TABLES, fetchOrganizationExport, exportOrganizationZip } from "../exportOrg";

const deletedAt = "2026-09-10T12:00:00.000Z";
const client = (id: string, deleted_at: string | null = null, organization_id = "org-a") => ({ id, organization_id, deleted_at });
const rows = (count: number) => Array.from({ length: count }, (_, i) => client(`a-${i}`, i % 2 ? deletedAt : null));

beforeEach(() => {
  h.current = createHistoricalReadMock();
  h.download.mockClear();
});

describe("export histórico: conservación de filas visibles", () => {
  it("conserva activas, bajas, IDs y relaciones sin imponer vigencia al catálogo mixto", async () => {
    const clientes = [client("viva"), client("baja", deletedAt), client("ajena", deletedAt, "org-b")];
    const contacto = { id: "contacto-baja", organization_id: "org-a", cliente_id: "baja", deleted_at: deletedAt };
    const configuracion = { id: "config-a", organization_id: "org-a", categoria: "empresa", clave: "nombre", valor: "Empresa A" };
    Object.assign(h.current!.tables, { clientes, contactos_cliente: [contacto], configuracion: [configuracion] });
    const result = await fetchOrganizationExport("org-a");
    expect(result.find((r) => r.table === "clientes")?.rows).toEqual(clientes.slice(0, 2));
    expect(result.find((r) => r.table === "contactos_cliente")?.rows).toEqual([contacto]);
    expect(result.find((r) => r.table === "configuracion")).toEqual({ table: "configuracion", rows: [configuracion], warning: undefined });
    expect(h.current!.calls.map((c) => c.table)).toEqual(EXPORT_TABLES);
    for (const call of h.current!.calls) {
      expect(call.columns).toBe("*");
      expect(call.filters).toEqual([{ method: "eq", column: "organization_id", value: "org-a" }]);
    }
    expect(h.current!.supabase.rpc).not.toHaveBeenCalled();
  });

  it.each([0, 999, 1000, 1001, 2000])("pagina %i filas con bajas sin duplicarlas ni perder el filtro de organización", async (count) => {
    const expected = rows(count);
    // B interleaved into the server fixture detects loss of the tenant predicate on any page.
    h.current!.tables.clientes = expected.flatMap((row, i) => [client(`b-${i}`, deletedAt, "org-b"), row]);
    const progress = vi.fn();
    const result = await fetchOrganizationExport("org-a", progress);
    expect(result.find((r) => r.table === "clientes")?.rows).toEqual(expected);
    const calls = h.current!.calls.filter((c) => c.table === "clientes");
    const pages = Math.floor(count / 1000) + 1;
    expect(calls.map((c) => c.range)).toEqual(Array.from({ length: pages }, (_, i) => [i * 1000, i * 1000 + 999]));
    for (const call of calls) expect(call.filters).toEqual([{ method: "eq", column: "organization_id", value: "org-a" }]);
    expect(progress.mock.calls.filter(([p]) => p.current === "clientes").at(-1)?.[0].rows).toBe(count);
  });

  it.each([false, true])("respeta la visibilidad simulada sin recuperar filas ocultas ni inventar warnings: vacío=%s", async (empty) => {
    h.current!.tables.clientes = [client("visible"), client("baja-visible", deletedAt), client("oculta", deletedAt)];
    h.current!.setVisible((_table, row) => !empty && row.id !== "oculta");
    const result = await fetchOrganizationExport("org-a");
    expect(result.find((r) => r.table === "clientes")).toEqual({
      table: "clientes", rows: empty ? [] : h.current!.tables.clientes.slice(0, 2), warning: undefined,
    });
    expect(h.current!.calls.map((c) => c.table)).toEqual(EXPORT_TABLES);
    expect(h.current!.supabase.rpc).not.toHaveBeenCalled();
  });

  it.each(["42501", "PGRST205", "42P01"])("conserva páginas parciales y warning %s, luego continúa el catálogo", async (code) => {
    h.current!.tables.clientes = rows(1001);
    h.current!.tables.proveedores = [client("proveedor-baja", deletedAt)];
    h.current!.errors.set("clientes:1000", { code, message: "synthetic read failure" });
    await exportOrganizationZip("org-a", "Comercial A");
    const [, files] = h.download.mock.calls[0];
    const manifest = JSON.parse(files["manifest.json"]);
    expect(files["clientes.csv"]).toBe(toCSV(rows(1000)));
    expect(files["proveedores.csv"]).toContain(deletedAt);
    expect(manifest.rows_by_table).toMatchObject({ clientes: 1000, proveedores: 1 });
    expect(manifest.warnings).toEqual({ clientes: `${code}: synthetic read failure` });
    expect(h.current!.calls.filter((c) => c.table === "clientes").map((c) => c.range)).toEqual([[0, 999], [1000, 1999]]);
  });

  it("representa el error inicial como cero filas con warning, sin interrumpir las tablas posteriores", async () => {
    h.current!.errors.set("clientes:0", { code: "42501", message: "sin permiso" });
    h.current!.tables.proveedores = [client("proveedor-a", deletedAt)];
    const result = await fetchOrganizationExport("org-a");
    expect(result[0]).toEqual({ table: "clientes", rows: [], warning: "42501: sin permiso" });
    expect(result[1].rows).toEqual(h.current!.tables.proveedores);
    expect(result).toHaveLength(EXPORT_TABLES.length);
  });

  it("aborta ante error duro posterior sin descargar un ZIP parcial", async () => {
    h.current!.tables.clientes = rows(1000);
    h.current!.errors.set("clientes:1000", { code: "XX000", message: "hard failure" });
    await expect(exportOrganizationZip("org-a", "Comercial A")).rejects.toThrow("clientes: hard failure");
    expect(h.download).not.toHaveBeenCalled();
    expect(h.current!.calls.map((c) => c.table)).toEqual(["clientes", "clientes"]);
  });

  it("serializa bajas con escaping y neutralización reales y un manifest de lo obtenido", async () => {
    const fixture: HistoricalRow[] = [
      { ...client("viva"), nombre: "Simple", detalle: null },
      { ...client("baja", deletedAt), nombre: 'Texto "citado"\nsegunda línea', detalle: { tipo: "histórico" }, formula: "=1+1" },
    ];
    h.current!.tables.clientes = fixture;
    h.current!.errors.set("proveedores:0", { code: "42501", message: "sin permiso" });
    await exportOrganizationZip("org-a", "Comercial A");
    expect(h.download).toHaveBeenCalledOnce();
    const [, files] = h.download.mock.calls[0];
    expect(files["clientes.csv"]).toBe([
      "id,organization_id,deleted_at,nombre,detalle,formula",
      "viva,org-a,,Simple,,",
      'baja,org-a,2026-09-10T12:00:00.000Z,"Texto ""citado""\nsegunda línea","{""tipo"":""histórico""}",\'=1+1',
    ].join("\n"));
    expect(Object.keys(files)).toEqual([...EXPORT_TABLES.map((t) => `${t}.csv`), "manifest.json"]);
    const manifest = JSON.parse(files["manifest.json"]);
    expect(manifest).toMatchObject({ organization_id: "org-a", organization_nombre: "Comercial A", tables: EXPORT_TABLES, groups: EXPORT_GROUPS });
    expect(manifest.rows_by_table.clientes).toBe(2);
    expect(manifest.rows_by_table.proveedores).toBe(0);
    expect(manifest.warnings).toEqual({ proveedores: "42501: sin permiso" });
    expect(manifest.app_version).toMatch(/^\d+\.\d+\.\d+/);
    expect(Number.isNaN(Date.parse(manifest.generated_at))).toBe(false);
  });
});
