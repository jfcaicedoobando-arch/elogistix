import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  type Row = { id: string; sin_comision: boolean | null; deleted_at: string | null; visible: boolean };
  const state = { row: null as Row | null, readError: null as Error | null, updateError: null as Error | null, readGate: null as Promise<void> | null };
  const calls: string[] = [];
  const from = vi.fn(() => {
    let id: unknown;
    let onlyActive = false;
    let update: { sin_comision: boolean | null } | undefined;
    let selected = false;
    const execute = () => {
      calls.push(update ? "update" : "read");
      const error = update ? state.updateError : state.readError;
      if (error) return { data: null, error };
      const row = state.row;
      if (!row || !row.visible || row.id !== id || (onlyActive && row.deleted_at)) {
        return { data: null, error: null };
      }
      if (update) row.sin_comision = update.sin_comision;
      return { data: selected ? { id: row.id, sin_comision: row.sin_comision } : null, error: null };
    };
    const query = {
      select: vi.fn(() => { selected = true; return query; }),
      eq: vi.fn((column: string, value: unknown) => { if (column === "id") id = value; return query; }),
      is: vi.fn((column: string, value: unknown) => { if (column === "deleted_at" && value === null) onlyActive = true; return query; }),
      update: vi.fn((value: { sin_comision: boolean | null }) => { update = value; return query; }),
      maybeSingle: vi.fn(async () => { if (!update && state.readGate) await state.readGate; return execute(); }),
      then: (resolve: (value: ReturnType<typeof execute>) => unknown) => Promise.resolve(execute()).then(resolve),
    };
    return query;
  });
  const rpc = vi.fn(() => { calls.push("resolver"); return Promise.resolve({ data: false, error: null as Error | null }); });
  const bitacora = vi.fn(() => { calls.push("bitacora"); return Promise.resolve(); });
  return { state, calls, from, rpc, bitacora };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
vi.mock("../bitacoraEmbarques", () => ({ registrarBitacoraEmbarque: mocks.bitacora }));

import { fetchSinComisionEmbarque, setSinComisionEmbarque } from "../comisionExclusion";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.calls.length = 0;
  mocks.state.row = { id: "e-1", sin_comision: null, deleted_at: null, visible: true };
  mocks.state.readGate = null;
  mocks.state.readError = null;
  mocks.state.updateError = null;
  mocks.rpc.mockImplementation(() => { mocks.calls.push("resolver"); return Promise.resolve({ data: false, error: null }); });
});

describe("fetchSinComisionEmbarque", () => {
  it("espera confirmar la fila antes de iniciar el resolver", async () => {
    let release!: () => void;
    mocks.state.readGate = new Promise<void>((resolve) => { release = resolve; });
    const pending = fetchSinComisionEmbarque("e-1");
    expect(mocks.rpc).not.toHaveBeenCalled();
    release();
    await expect(pending).resolves.toEqual({ override: null, efectivo: false });
    expect(mocks.calls).toEqual(["read", "resolver"]);
  });

  it.each(["inexistente", "borrado", "no visible"])("devuelve ausencia explícita para embarque %s sin resolver comisión", async (kind) => {
    if (kind === "inexistente") mocks.state.row = null;
    else if (kind === "borrado") mocks.state.row!.deleted_at = "2026-10-13T00:00:00Z";
    else mocks.state.row!.visible = false;

    await expect(fetchSinComisionEmbarque("e-1")).resolves.toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from.mock.results[0].value.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("propaga el error de lectura sin invocar el resolver", async () => {
    const error = new Error("Lectura no disponible");
    mocks.state.readError = error;
    await expect(fetchSinComisionEmbarque("e-1")).rejects.toBe(error);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    [null, false], [null, true], [true, true], [false, false],
  ] as const)("conserva override %s y resultado efectivo %s de un embarque vigente", async (override, efectivo) => {
    mocks.state.row!.sin_comision = override;
    mocks.rpc.mockImplementation(() => { mocks.calls.push("resolver"); return Promise.resolve({ data: efectivo, error: null }); });
    await expect(fetchSinComisionEmbarque("e-1")).resolves.toEqual({ override, efectivo });
    expect(mocks.calls).toEqual(["read", "resolver"]);
    expect(mocks.rpc).toHaveBeenCalledWith("resolver_sin_comision", { p_embarque_id: "e-1" });
    expect(mocks.from.mock.results[0].value.eq).toHaveBeenCalledWith("id", "e-1");
  });

  it("propaga el error del resolver sin fabricar un resultado efectivo", async () => {
    const error = new Error("Resolver no disponible");
    mocks.rpc.mockResolvedValue({ data: false, error });
    await expect(fetchSinComisionEmbarque("e-1")).rejects.toBe(error);
  });
});

describe("setSinComisionEmbarque", () => {
  it.each(["inexistente", "borrado", "no visible"])("rechaza UPDATE sin fila para embarque %s y no registra bitácora", async (kind) => {
    if (kind === "inexistente") mocks.state.row = null;
    else if (kind === "borrado") mocks.state.row!.deleted_at = "2026-10-13T00:00:00Z";
    else mocks.state.row!.visible = false;

    await expect(setSinComisionEmbarque("e-1", true)).rejects.toThrow("El embarque no está disponible");
    expect(mocks.bitacora).not.toHaveBeenCalled();
    if (mocks.state.row) expect(mocks.state.row.sin_comision).toBeNull();
    const query = mocks.from.mock.results[0].value;
    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
    expect(query.select).toHaveBeenCalledWith("id");
  });

  it("propaga el error de actualización sin registrar bitácora", async () => {
    const error = new Error("Sin permiso de escritura");
    mocks.state.updateError = error;
    await expect(setSinComisionEmbarque("e-1", true)).rejects.toBe(error);
    expect(mocks.bitacora).not.toHaveBeenCalled();
  });

  it.each([null, true, false])("guarda y permite repetir el mismo override %s de una fila vigente", async (valor) => {
    await expect(setSinComisionEmbarque("e-1", valor)).resolves.toBeUndefined();
    await expect(setSinComisionEmbarque("e-1", valor)).resolves.toBeUndefined();
    expect(mocks.state.row!.sin_comision).toBe(valor);
    expect(mocks.calls).toEqual(["update", "bitacora", "update", "bitacora"]);
    expect(mocks.bitacora).toHaveBeenCalledTimes(2);
    expect(mocks.bitacora).toHaveBeenLastCalledWith({ accion: "actualizar_sin_comision", entidadId: "e-1", detalles: { valor } });
  });

  it("rechaza el guardado si el embarque se borró después de la lectura", async () => {
    await fetchSinComisionEmbarque("e-1");
    mocks.state.row!.deleted_at = "2026-10-13T00:00:00Z";
    await expect(setSinComisionEmbarque("e-1", false)).rejects.toThrow("El embarque no está disponible");
    expect(mocks.bitacora).not.toHaveBeenCalled();
    expect(mocks.state.row!.sin_comision).toBeNull();
  });
});
