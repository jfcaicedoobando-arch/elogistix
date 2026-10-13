import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const state = { row: null as Row | null, readError: null as Error | null };
  const from = vi.fn((table: string) => {
    if (table !== "pagos_factura") throw new Error(`Unexpected table: ${table}`);
    const filters: [string, unknown][] = [];
    let columns: string[] = [];
    const query = {
      select: vi.fn((value: string) => { columns = value.split(",").map((c) => c.trim()); return query; }),
      eq: vi.fn((key: string, value: unknown) => { filters.push([key, value]); return query; }),
      is: vi.fn((key: string, value: unknown) => { filters.push([key, value]); return query; }),
      maybeSingle: vi.fn(async () => {
        if (state.readError) return { data: null, error: state.readError };
        const row = state.row;
        const matches = row && filters.every(([key, value]) => row[key] === value);
        return { data: matches ? Object.fromEntries(columns.map((key) => [key, row[key]])) : null, error: null };
      }),
    };
    return query;
  });
  return { state, from, rpc: vi.fn() };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mock.from, rpc: mock.rpc } }));

import { eliminarPagoFactura, PagoConRepVivoError } from "../eliminarPago";

const IDEMPOTENT = { movimientos_baja: 0, movimientos_desvinculados: 0, ya_eliminado: true };
const ZERO_RESULT = { movimientosBaja: 0, movimientosDesvinculados: 0, yaEliminado: true };

beforeEach(() => {
  vi.clearAllMocks();
  mock.state.row = { id: "p-1", factura_id: "f-1", uuid_rep: null, rep_cancelado_en: null, deleted_at: null };
  mock.state.readError = null;
  mock.rpc.mockReset().mockResolvedValue({ data: IDEMPOTENT, error: null });
});

describe("eliminarPagoFactura: precheck operativo subordinado a la RPC", () => {
  it("delega un tombstone con UUID REP retenido y conserva la respuesta idempotente", async () => {
    Object.assign(mock.state.row!, { uuid_rep: "rep-historico", deleted_at: "2026-10-13T00:00:00Z" });
    await expect(eliminarPagoFactura("p-1")).resolves.toEqual(ZERO_RESULT);
    await expect(eliminarPagoFactura("p-1")).resolves.toEqual(ZERO_RESULT);
    expect(mock.rpc).toHaveBeenCalledTimes(2);
    expect(mock.rpc).toHaveBeenLastCalledWith("eliminar_pago_cliente", { _pago_id: "p-1" });
    expect(mock.from.mock.results[0].value.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("no inventa éxito local para el tombstone si falla la RPC", async () => {
    Object.assign(mock.state.row!, { uuid_rep: "rep-historico", deleted_at: "2026-10-13T00:00:00Z" });
    const error = new Error("No autorizado por la RPC");
    mock.rpc.mockResolvedValue({ data: null, error });
    await expect(eliminarPagoFactura("p-1")).rejects.toBe(error);
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });

  it("mantiene el bloqueo anticipado de un pago vivo con REP vigente", async () => {
    mock.state.row!.uuid_rep = "rep-vivo";
    await expect(eliminarPagoFactura("p-1")).rejects.toMatchObject({
      name: "PagoConRepVivoError", code: "LC_PAGO_CON_REP_VIVO", uuidRep: "rep-vivo",
    });
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it.each([null, "rep-cancelado"])("permite un pago vivo sin REP vigente: %s", async (uuid) => {
    Object.assign(mock.state.row!, { uuid_rep: uuid, rep_cancelado_en: uuid ? "2026-10-12T00:00:00Z" : null });
    mock.rpc.mockResolvedValue({ data: { movimientos_baja: 2, movimientos_desvinculados: 3, ya_eliminado: false }, error: null });
    await expect(eliminarPagoFactura("p-1")).resolves.toEqual({ movimientosBaja: 2, movimientosDesvinculados: 3, yaEliminado: false });
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });

  it.each(["ausente", "error"])("delega precheck %s y propaga el error autoritativo", async (kind) => {
    if (kind === "ausente") mock.state.row = null;
    else mock.state.readError = new Error("Precheck no disponible");
    const error = new Error("LC_PAGO_NO_ENCONTRADO");
    mock.rpc.mockResolvedValue({ data: null, error });
    await expect(eliminarPagoFactura("p-1")).rejects.toBe(error);
    expect(mock.rpc).toHaveBeenCalledWith("eliminar_pago_cliente", { _pago_id: "p-1" });
  });

  it("conserva el guard SQL si un REP aparece después del precheck", async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { message: "LC_PAGO_CON_REP_VIVO: REP apareció durante la carrera" } });
    await expect(eliminarPagoFactura("p-1")).rejects.toBeInstanceOf(PagoConRepVivoError);
    await expect(eliminarPagoFactura("p-1")).rejects.toMatchObject({ code: "LC_PAGO_CON_REP_VIVO", uuidRep: null });
    expect(mock.rpc).toHaveBeenCalledTimes(2);
  });

  it("un error del precheck no oculta el guard REP autoritativo", async () => {
    mock.state.readError = new Error("Precheck no disponible");
    mock.rpc.mockResolvedValue({ data: null, error: new Error("LC_PAGO_CON_REP_VIVO") });
    await expect(eliminarPagoFactura("p-1")).rejects.toMatchObject({ code: "LC_PAGO_CON_REP_VIVO", uuidRep: null });
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });

  it("permite reintentar después de la primera baja y conserva ceros del servidor", async () => {
    mock.rpc.mockImplementationOnce(async () => {
      mock.state.row!.deleted_at = "2026-10-13T00:00:00Z";
      return { data: { movimientos_baja: 1, movimientos_desvinculados: 0, ya_eliminado: false }, error: null };
    });
    await expect(eliminarPagoFactura("p-1")).resolves.toEqual({ movimientosBaja: 1, movimientosDesvinculados: 0, yaEliminado: false });
    await expect(eliminarPagoFactura("p-1")).resolves.toEqual(ZERO_RESULT);
    expect(mock.rpc).toHaveBeenCalledTimes(2);
    // Sin INSERT, UPDATE ni DELETE en el mock: una mutación directa fallaría.
    expect(mock.from).toHaveBeenCalledTimes(2);
  });
});
