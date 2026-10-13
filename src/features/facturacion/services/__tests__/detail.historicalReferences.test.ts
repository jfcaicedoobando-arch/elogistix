import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHistoricalReadMock } from "@/test/helpers/historicalReadMock";

const h = vi.hoisted(() => ({ current: null as ReturnType<typeof createHistoricalReadMock> | null }));
vi.mock("@/integrations/supabase/client", () => ({ get supabase() { return h.current!.supabase; } }));
import { fetchFacturaById } from "../detail";

const deletedAt = "2026-10-01T12:00:00.000Z";
const factura = (overrides: Record<string, unknown> = {}) => ({
  id: "factura-original", numero: "F-001", organization_id: "org-a",
  cliente_id: "cliente-a", cliente_nombre: "Nombre emitido", estado: "Sustituida",
  sustituida_por: "factura-sustituta", proforma_id: "proforma-origen", deleted_at: null,
  snapshot_emision: { receptor: { nombre: "Nombre emitido" } }, ...overrides,
});
const sustituta = (deleted_at: string | null = null, estado = "Emitida") => ({
  id: "factura-sustituta", numero: "F-002", estado, organization_id: "org-a", deleted_at,
});
const proforma = (deleted_at: string | null = null) => ({
  id: "proforma-origen", numero: "PF-001", organization_id: "org-a", deleted_at,
});
const refCall = (table: string, columns: string, id: string) => ({
  table, columns, filters: [{ method: "eq", column: "id", value: id }],
});

beforeEach(() => {
  h.current = createHistoricalReadMock();
  h.current.tables.facturas = [factura(), sustituta()];
  h.current.tables.proformas = [proforma()];
});

function failRead(index: number, error: { code: string; message: string }, reject: boolean) {
  const from = h.current!.supabase.from.getMockImplementation()!;
  h.current!.supabase.from.mockImplementation((table) => {
    const builder = from(table);
    if (h.current!.calls.length - 1 === index) {
      vi.spyOn(builder, "maybeSingle").mockImplementation(async () => {
        if (reject) throw error;
        return { data: null, error };
      });
    }
    return builder;
  });
}

describe("referencias históricas del detalle: builders independientes de la factura principal", () => {
  it.each([
    { sustituida_por: null, proforma_id: null, tablas: ["facturas"] },
    { sustituida_por: "factura-sustituta", proforma_id: null, tablas: ["facturas", "facturas"] },
    { sustituida_por: null, proforma_id: "proforma-origen", tablas: ["facturas", "proformas"] },
    { sustituida_por: "factura-sustituta", proforma_id: "proforma-origen", tablas: ["facturas", "facturas", "proformas"] },
  ])("sólo consulta la referencia cuya FK existe: $sustituida_por / $proforma_id", async ({ tablas, ...ids }) => {
    h.current!.tables.facturas[0] = factura(ids);
    const result = await fetchFacturaById("factura-original");
    expect(h.current!.calls.map((call) => call.table)).toEqual(tablas);
    expect(result).toMatchObject({ ...ids,
      sustituida_por_ref: ids.sustituida_por ? { id: "factura-sustituta", numero: "F-002", estado: "Emitida" } : null,
      proformas: ids.proforma_id ? { numero: "PF-001" } : null,
    });
    expect(h.current!.supabase.rpc).not.toHaveBeenCalled();
  });

  it.each([
    [null, null], [deletedAt, null], [null, deletedAt], [deletedAt, deletedAt],
  ])("resuelve ambas referencias visibles con sus proyecciones exactas: bajas %s / %s", async (bajaSustituta, bajaProforma) => {
    // Los señuelos preceden a las filas correctas para detectar IDs omitidos o cruzados.
    h.current!.tables.facturas = [factura(), { ...sustituta(), id: "otra-factura", numero: "NO" }, sustituta(bajaSustituta)];
    h.current!.tables.proformas = [{ ...proforma(), id: "otra-proforma", numero: "NO" }, proforma(bajaProforma)];
    const result = await fetchFacturaById("factura-original");
    expect(result).toMatchObject({ sustituida_por: "factura-sustituta", proforma_id: "proforma-origen" });
    expect(result!.sustituida_por_ref).toEqual({ id: "factura-sustituta", numero: "F-002", estado: "Emitida" });
    expect(result!.proformas).toEqual({ numero: "PF-001" });
    expect(h.current!.calls.slice(1)).toEqual([
      refCall("facturas", "id, numero, estado", "factura-sustituta"),
      refCall("proformas", "numero", "proforma-origen"),
    ]);
    expect(h.current!.supabase.rpc).not.toHaveBeenCalled();
  });

  it.each(["Cancelada", "Sustituida"])("preserva estado %s y snapshot de la principal aunque las referencias estén dadas de baja", async (estado) => {
    const principal = factura({ estado });
    h.current!.tables.facturas = [principal, sustituta(deletedAt, estado)];
    h.current!.tables.proformas = [proforma(deletedAt)];
    const result = await fetchFacturaById(principal.id);
    expect(result).toMatchObject({ estado, cliente_nombre: "Nombre emitido", snapshot_emision: principal.snapshot_emision,
      sustituida_por: "factura-sustituta", proforma_id: "proforma-origen" });
    expect(result!.sustituida_por_ref).toEqual({ id: "factura-sustituta", numero: "F-002", estado });
    expect(result!.proformas).toEqual({ numero: "PF-001" });
  });

  it.each(["ausente", "invisible"])("no consulta hijos si la principal está %s", async (motivo) => {
    if (motivo === "ausente") h.current!.tables.facturas.shift();
    else h.current!.setVisible((_table, row) => row.id !== "factura-original");
    expect(await fetchFacturaById("factura-original")).toBeNull();
    expect(h.current!.calls.map((call) => call.table)).toEqual(["facturas"]);
  });

  it.each([
    { table: "facturas", id: "factura-sustituta", motivo: "ausente" },
    { table: "facturas", id: "factura-sustituta", motivo: "invisible" },
    { table: "proformas", id: "proforma-origen", motivo: "ausente" },
    { table: "proformas", id: "proforma-origen", motivo: "invisible" },
  ])("referencia $table $motivo: null sin perder FK ni la otra referencia", async ({ table, id, motivo }) => {
    if (motivo === "ausente") h.current!.tables[table] = h.current!.tables[table].filter((row) => row.id !== id);
    else h.current!.setVisible((tabla, row) => tabla !== table || row.id !== id);
    const result = await fetchFacturaById("factura-original");
    expect(result).toMatchObject({ sustituida_por: "factura-sustituta", proforma_id: "proforma-origen", estado: "Sustituida" });
    expect(result!.sustituida_por_ref).toEqual(table === "facturas" ? null : { id: "factura-sustituta", numero: "F-002", estado: "Emitida" });
    expect(result!.proformas).toEqual(table === "proformas" ? null : { numero: "PF-001" });
    expect(h.current!.calls.slice(1)).toEqual([
      refCall("facturas", "id, numero, estado", "factura-sustituta"),
      refCall("proformas", "numero", "proforma-origen"),
    ]);
  });

  it("mantiene ambas FK cuando ninguna referencia es visible", async () => {
    h.current!.setVisible((_table, row) => row.id === "factura-original");
    expect(await fetchFacturaById("factura-original")).toMatchObject({
      sustituida_por: "factura-sustituta", proforma_id: "proforma-origen", sustituida_por_ref: null, proformas: null,
    });
    expect(h.current!.calls).toHaveLength(3);
  });

  it.each([
    { index: 0, label: "principal", reject: false }, { index: 0, label: "principal", reject: true },
    { index: 1, label: "sustituta", reject: false }, { index: 1, label: "sustituta", reject: true },
    { index: 2, label: "proforma", reject: false }, { index: 2, label: "proforma", reject: true },
  ])("propaga el error exacto de $label (rechazo=$reject) sin convertirlo en ausencia", async ({ index, label, reject }) => {
    const error = { code: "42501", message: `Fallo sintético de ${label}` };
    failRead(index, error, reject);
    await expect(fetchFacturaById("factura-original")).rejects.toBe(error);
    expect(h.current!.calls).toHaveLength(index + 1);
    expect(h.current!.supabase.rpc).not.toHaveBeenCalled();
  });
});
