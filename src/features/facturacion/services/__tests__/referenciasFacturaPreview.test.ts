import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { fetchReferenciasFacturaPreview } from "../referenciasEmbarque";

const factura = { id: "f1", organization_id: "org-1", embarque_id: "e21", expediente: "HEADER-21", referencia_bl: "HEADER-H" };
const c22 = { id: "c22", descripcion: "Concepto de dos pesos", embarque_id: "e22" };
const c21 = { id: "c21", descripcion: "Concepto de tres pesos", embarque_id: "e21" };
const e22 = { id: "e22", expediente: "ELNAC22", bl_master: "M22", bl_house: "H22" };
const e21 = { id: "e21", expediente: "ELNAC21", bl_master: null, bl_house: null };

function filas(conceptos: unknown[], embarques: unknown[] = [e21, e22]) {
  mock.setTableResult("conceptos_factura", { data: conceptos, error: null });
  mock.setTableResult("embarques", { data: embarques, error: null });
}

describe("referencias de factura · preview143", () => {
  beforeEach(() => { mock.resetResults(); mock.tableCalls.length = 0; });

  it("resuelve la fusión por ID sin heredar cabecera ni depender del orden de embarques", async () => {
    filas([c22, c21, { ...c22, id: "c22b" }]);
    const result = await fetchReferenciasFacturaPreview(factura, "org-1");
    expect(result.modo).toBe("por_concepto");
    expect(result.conceptos.map((c) => [c.id, c.referencias?.expediente])).toEqual([
      ["c22", "ELNAC22"], ["c21", "ELNAC21"], ["c22b", "ELNAC22"],
    ]);
    expect(JSON.stringify(result)).not.toContain("HEADER");
    expect(mock.tableCalls).toHaveLength(2);
    const [conceptos, embarques] = mock.tableCalls;
    expect(conceptos.opArgs).toContainEqual(["organization_id", "org-1"]);
    expect(conceptos.opArgs).toContainEqual(["factura_id", "f1"]);
    expect(conceptos.opArgs).toContainEqual(["deleted_at", null]);
    expect(embarques.opArgs).toContainEqual(["organization_id", "org-1"]);
    expect(embarques.opArgs).toContainEqual(["id", ["e22", "e21"]]);
    expect(embarques.opArgs).toContainEqual(["deleted_at", null]);
    expect(mock.tableCalls.flatMap((c) => c.ops)).not.toEqual(expect.arrayContaining(["update", "insert", "delete"]));
    expect(c22).toEqual({ id: "c22", descripcion: "Concepto de dos pesos", embarque_id: "e22" });
  });

  it("individual con origen conserva los BLs propios sin fallback de cabecera", async () => {
    filas([c22]);
    const result = await fetchReferenciasFacturaPreview(factura, "org-1");
    expect(result.conceptos[0]).toMatchObject({ referencias: e22, estado: "verificado" });
    expect(mock.tableCalls[1].opArgs).toContainEqual(["id", ["e22"]]);
  });

  it("línea manual en factura mixta no hereda referencias de otro concepto", async () => {
    filas([c22, { ...c21, embarque_id: null }]);
    const result = await fetchReferenciasFacturaPreview(factura, "org-1");
    expect(result.conceptos[1]).toEqual({ id: c21.id, descripcion: c21.descripcion, estado: "sin_origen", referencias: null });
  });

  it("manual sin origen ni snapshots no consulta embarques ni inventa un prefijo", async () => {
    filas([{ ...c21, embarque_id: null }]);
    const result = await fetchReferenciasFacturaPreview({ id: "f1", organization_id: "org-1" }, "org-1");
    expect(result.conceptos[0].referencias).toEqual({ expediente: null, bl_master: null, bl_house: null });
    expect(mock.tableCalls).toHaveLength(1);
  });

  it("fallback legado mantiene las reglas nullish de expediente y BL House", async () => {
    filas([{ ...c21, embarque_id: null }], [{ ...e21, expediente: null, bl_master: "M-LEGACY", bl_house: null }]);
    const result = await fetchReferenciasFacturaPreview(factura, "org-1");
    expect(result.modo).toBe("cabecera_legada");
    expect(result.conceptos[0].referencias).toEqual({ expediente: "HEADER-21", bl_master: "M-LEGACY", bl_house: "HEADER-H" });
  });

  it("legado sin embarque usa exclusivamente los snapshots de su propia factura", async () => {
    filas([{ ...c21, embarque_id: null }]);
    const result = await fetchReferenciasFacturaPreview({ ...factura, embarque_id: null }, "org-1");
    expect(result.conceptos[0].referencias).toEqual({ expediente: "HEADER-21", bl_master: null, bl_house: "HEADER-H" });
    expect(mock.tableCalls).toHaveLength(1);
  });

  it("origen ausente, invisible o fuera de scope no se reemplaza por cabecera", async () => {
    filas([c22, c21], [e21]);
    const result = await fetchReferenciasFacturaPreview(factura, "org-1");
    expect(result.conceptos[0]).toMatchObject({ estado: "no_disponible", referencias: null });
    expect(result.conceptos[1]).toMatchObject({ estado: "verificado", referencias: e21 });
    expect(JSON.stringify(result)).not.toContain("HEADER");
  });

  it("cabecera legada invisible no presenta snapshots como verificación del servidor", async () => {
    filas([{ ...c21, embarque_id: null }], []);
    const result = await fetchReferenciasFacturaPreview(factura, "org-1");
    expect(result.conceptos[0]).toMatchObject({ estado: "no_disponible", referencias: null });
  });

  it.each(["conceptos_factura", "embarques"])("fallo de %s se propaga sin resultado fabricado", async (tabla) => {
    filas([c22]);
    mock.setTableResult(tabla, { data: null, error: new Error("fallo de consulta") });
    await expect(fetchReferenciasFacturaPreview(factura, "org-1")).rejects.toThrow("fallo de consulta");
  });

  it("no confunde cero conceptos con referencias de cabecera para todos", async () => {
    filas([]);
    const result = await fetchReferenciasFacturaPreview(factura, "org-1");
    expect(result.conceptos).toEqual([]);
    expect(mock.tableCalls).toHaveLength(1);
  });

  it.each([
    { ...factura, organization_id: "otra-org" },
    { ...factura, organization_id: null },
    { ...factura, id: undefined },
  ])("scope inválido no consulta ni usa snapshots $organization_id", async (input) => {
    await expect(fetchReferenciasFacturaPreview(input, "org-1")).rejects.toThrow("organización");
    expect(mock.tableCalls).toEqual([]);
  });
});
