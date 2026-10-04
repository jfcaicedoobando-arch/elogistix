import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
const bitacora = vi.hoisted(() => vi.fn());
vi.mock("../conciliacionBitacora", () => ({ bitacoraImportarMovimientos: bitacora }));
import { importarMovimientos, ImportacionParcialError } from "../conciliacionImportar";
import { clasificarRevisionImportacion } from "../../domain/import/revisionImportacion";

const fila = { fecha: "2026-10-03", concepto: "Cobro", referencia: "R", cargo: 0, abono: 25, saldo: 100, hash_dedupe: "banco" };
const espejo = { id: "e1", cuenta_bancaria_id: "cta", pago_factura_id: "p1", fecha: "2026-10-02", cargo: 0, abono: 25, hash_dedupe: "cobro-p1" };
beforeEach(() => { mock.resetResults(); mock.tableCalls.length = 0; mock.rpcCalls.length = 0; bitacora.mockClear(); });
describe("Confirmación bancaria con vínculos revisados", () => {
  it("envía el candidato original y su huella completa; separa vínculo de duplicado", async () => {
    mock.setRpcResult("absorber_espejos_importacion", { data: { absorbidos: 1 }, error: null });
    mock.setTableResult("bbva_movimientos", { data: [{ hash_dedupe: fila.hash_dedupe }], error: null });
    const revision = clasificarRevisionImportacion([fila], new Set(), [espejo]);
    expect(await importarMovimientos("cta", [fila], "u1", revision.filas)).toEqual({ total: 1, nuevos: 0, duplicados: 0, vinculados: 1 });
    expect(mock.rpcCalls[0].args).toMatchObject({ p_filas: [{ espejo_revisado_id: "e1", espejo_revisado_huella: { cuenta_bancaria_id: "cta", hash_dedupe: "cobro-p1", pago_factura_id: "p1", fecha: "2026-10-02", cargo: 0, abono: 25 } }] });
    expect(mock.tableCalls.some((c) => c.ops.includes("insert"))).toBe(false);
  });
  it("cada fila sin vínculo tiene null explícito para impedir absorción nueva tras la revisión", async () => {
    mock.setTableResultOnce("bbva_movimientos", { data: [], error: null });
    mock.setTableResultOnce("bbva_movimientos", { data: [{ id: "m1" }], error: null });
    await importarMovimientos("cta", [fila], null, clasificarRevisionImportacion([fila], new Set(), []).filas);
    expect(mock.rpcCalls[0].args).toMatchObject({ p_filas: [{ espejo_revisado_id: null, espejo_revisado_huella: null }] });
  });
  it("una carrera rechazada por SQL no inicia inserts", async () => {
    const error = { code: "23514", message: "LC_IMPORTACION_REVISION_CAMBIO" };
    mock.setRpcResult("absorber_espejos_importacion", { data: null, error });
    await expect(importarMovimientos("cta", [fila], null, clasificarRevisionImportacion([fila], new Set(), []).filas)).rejects.toEqual(error);
    expect(mock.tableCalls).toHaveLength(0);
  });
  it("un fallo de dedupe impide tratar todos los movimientos como nuevos", async () => {
    mock.setTableResult("bbva_movimientos", { data: null, error: { message: "falló la lectura" } });
    await expect(importarMovimientos("cta", [fila], null)).rejects.toMatchObject({ message: "falló la lectura" });
    expect(mock.tableCalls.some((c) => c.ops.includes("insert"))).toBe(false);
  });
  it("un resumen de otro archivo se rechaza antes de cualquier RPC", async () => {
    const revision = clasificarRevisionImportacion([{ ...fila, hash_dedupe: "otro" }], new Set(), []);
    await expect(importarMovimientos("cta", [fila], null, revision.filas)).rejects.toThrow("no corresponde");
    expect(mock.rpcCalls).toHaveLength(0);
  });
  it("un caller directo con hash repetido inserta una vez sin alterar hashes del parser", async () => {
    mock.setTableResultOnce("bbva_movimientos", { data: [], error: null });
    mock.setTableResultOnce("bbva_movimientos", { data: [{ id: "m1" }], error: null });
    expect(await importarMovimientos("cta", [fila, fila], null)).toEqual({ total: 2, nuevos: 1, duplicados: 1 });
    expect(mock.getMutationPayload("bbva_movimientos")).toEqual([expect.objectContaining({ hash_dedupe: "banco" })]);
  });
  it("un vínculo confirmado seguido de INSERT fallido informa ambos efectos y conserva la causa", async () => {
    const nueva = { ...fila, hash_dedupe: "nuevo", abono: 10 };
    const causa = { message: "falló insert", code: "23514" };
    mock.setRpcResult("absorber_espejos_importacion", { data: { absorbidos: 1 }, error: null });
    mock.setTableResultOnce("bbva_movimientos", { data: [{ hash_dedupe: "banco" }], error: null });
    mock.setTableResultOnce("bbva_movimientos", { data: null, error: causa });
    const revision = clasificarRevisionImportacion([fila, nueva], new Set(), [espejo]);
    const error = await importarMovimientos("cta", [fila, nueva], null, revision.filas).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ImportacionParcialError);
    expect(error).toMatchObject({ guardados: 0, vinculados: 1, faltantes: 1, causa });
    expect((error as Error).message).toContain("se guardaron 0 movimientos nuevos, se vincularon 1 movimientos internos y quedaron 1 nuevos pendientes");
    expect(bitacora).toHaveBeenCalledWith("cta", 2, 0, 0, { faltantes: 1, vinculados: 1 });
  });
});
