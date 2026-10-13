import { beforeEach, describe, expect, it, vi } from "vitest";
import { actualizarTcEmbarqueDof, fetchEmbarqueTcContexto } from "../tcEmbarqueDof";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), dof: vi.fn(), registrar: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
vi.mock("@/features/catalogos/services/tipoCambioDof", () => ({ fetchTcDofPorFecha: mocks.dof }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: mocks.registrar }));

const fila = {
  id: "emb-1", expediente: "EXP-1", estado: "En tránsito", deleted_at: null,
  created_at: "2026-10-13T18:00:00.000Z", tipo_cambio_usd: 20, tipo_cambio_eur: 22,
};
const dof = { fecha: "2026-10-13", usdMxn: 19, eurMxn: 21, exacto: true };
const respuesta = {
  fecha_dof: "2026-10-13", usd_anterior: 20, usd_nuevo: 19, eur_anterior: 22, eur_nuevo: 21,
};

function embarques(rows: Array<Omit<typeof fila, "deleted_at"> & { deleted_at: string | null }> | null, error: unknown = null) {
  let vigentes = false;
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    is: vi.fn((col: string, value: unknown) => { vigentes = col === "deleted_at" && value === null; return query; }),
    limit: vi.fn(() => Promise.resolve({ data: vigentes ? rows?.filter(row => row.deleted_at === null) ?? null : rows, error })),
  };
  mocks.from.mockReturnValue(query);
  return query;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.dof.mockResolvedValue(dof);
  mocks.rpc.mockResolvedValue({ data: respuesta, error: null });
  mocks.registrar.mockResolvedValue(undefined);
});

describe("fetchEmbarqueTcContexto", () => {
  it("excluye el embarque eliminado antes de consultar DOF", async () => {
    const query = embarques([{ ...fila, deleted_at: "2026-10-13T18:05:00Z" }]);
    await expect(fetchEmbarqueTcContexto("emb-1")).resolves.toBeNull();
    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
    expect(mocks.dof).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([{ rows: [] }, { rows: null }])("no busca DOF cuando la lectura no encuentra embarque: $rows", async ({ rows }) => {
    embarques(rows);
    await expect(fetchEmbarqueTcContexto("emb-1")).resolves.toBeNull();
    expect(mocks.dof).not.toHaveBeenCalled();
  });

  it("mantiene el contexto y la desviación de un embarque vivo válido", async () => {
    const query = embarques([fila]);
    const result = await fetchEmbarqueTcContexto("emb-1");
    expect(result).toMatchObject({ embarqueId: "emb-1", expediente: "EXP-1", estado: "En tránsito", tcUsd: 20, tcEur: 22, fechaReferencia: "2026-10-13", dof, fueraDeDof: true, editable: true });
    expect(result?.desviacionPct).toBeCloseTo(100 / 19);
    expect(query.eq).toHaveBeenCalledWith("id", "emb-1");
    expect(mocks.dof).toHaveBeenCalledExactlyOnceWith("2026-10-13");
  });

  it.each(["Cerrado", "Cancelado"])("conserva el histórico vivo %s sin permitir edición", async (estado) => {
    embarques([{ ...fila, estado }]);
    await expect(fetchEmbarqueTcContexto("emb-1")).resolves.toMatchObject({ estado, editable: false, dof, tcUsd: 20, tcEur: 22 });
    expect(mocks.dof).toHaveBeenCalledTimes(1);
  });

  it("propaga el error de lectura sin buscar DOF ni fingir ausencia", async () => {
    const error = { message: "Lectura denegada", code: "42501" };
    embarques([fila], error);
    await expect(fetchEmbarqueTcContexto("emb-1")).rejects.toBe(error);
    expect(mocks.dof).not.toHaveBeenCalled();
  });

  it("propaga el error DOF y conserva la ausencia legítima de DOF", async () => {
    embarques([fila]);
    const error = new Error("DOF no disponible");
    mocks.dof.mockRejectedValueOnce(error).mockResolvedValueOnce(null);
    await expect(fetchEmbarqueTcContexto("emb-1")).rejects.toBe(error);
    await expect(fetchEmbarqueTcContexto("emb-1")).resolves.toMatchObject({ dof: null, desviacionPct: null, fueraDeDof: false });
  });
});

describe("actualizarTcEmbarqueDof", () => {
  it("consume la respuesta completa una sola vez y registra todos los importes", async () => {
    await expect(actualizarTcEmbarqueDof("emb-1", "2026-10-13")).resolves.toEqual(respuesta);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("actualizar_tc_embarque_dof", { _embarque_id: "emb-1", _fecha: "2026-10-13" });
    expect(mocks.registrar).toHaveBeenCalledExactlyOnceWith({
      modulo: "embarques", accion: "Alineó el tipo de cambio al DOF", entidadId: "emb-1",
      detalles: { fechaDof: "2026-10-13", usdAnterior: 20, usdNuevo: 19, eurAnterior: 22, eurNuevo: 21 },
    });
  });

  it("preserva los importes anteriores y EUR nulos legítimos", async () => {
    const data = { ...respuesta, usd_anterior: null, eur_anterior: null, eur_nuevo: null };
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(actualizarTcEmbarqueDof("emb-1", "2026-10-13")).resolves.toEqual(data);
    expect(mocks.registrar).toHaveBeenCalledWith(expect.objectContaining({ detalles: expect.objectContaining({ usdAnterior: null, eurAnterior: null, eurNuevo: null }) }));
  });

  it.each([
    null, {}, [], { ...respuesta, fecha_dof: "" }, { ...respuesta, fecha_dof: "13/10/2026" },
    { ...respuesta, usd_nuevo: "19" }, { ...respuesta, usd_nuevo: Number.NaN },
    { ...respuesta, usd_nuevo: Infinity }, { ...respuesta, usd_nuevo: 0 },
    { ...respuesta, usd_anterior: undefined }, { ...respuesta, eur_nuevo: undefined },
    { ...respuesta, eur_anterior: Infinity },
  ].map(data => ({ data })))("rechaza una respuesta incompleta o inválida sin repetir la RPC: $data", async ({ data }) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(actualizarTcEmbarqueDof("emb-1", "2026-10-13")).rejects.toThrow(/Actualiza el embarque antes de volver a intentarlo/);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.registrar).not.toHaveBeenCalled();
  });

  it("propaga el error de RPC sin una segunda escritura ni bitácora de éxito", async () => {
    const error = { message: "El embarque está cerrado", code: "42501" };
    mocks.rpc.mockResolvedValue({ data: respuesta, error });
    await expect(actualizarTcEmbarqueDof("emb-1", "2026-10-13")).rejects.toBe(error);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.registrar).not.toHaveBeenCalled();
  });
});
