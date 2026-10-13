import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const state = { row: null as Row | null, error: null as Error | null, gate: null as Promise<void> | null };
  const from = vi.fn((table: string) => {
    if (table !== "embarques") throw new Error(`Unexpected catalog lookup: ${table}`);
    const filters: [string, unknown][] = [];
    let columns: string[] = [];
    const query = {
      select: vi.fn((value: string) => { columns = value.split(",").map((c) => c.trim()); return query; }),
      eq: vi.fn((key: string, value: unknown) => { filters.push([key, value]); return query; }),
      is: vi.fn((key: string, value: unknown) => { filters.push([key, value]); return query; }),
      maybeSingle: vi.fn(async () => {
        if (state.gate) await state.gate;
        if (state.error) return { data: null, error: state.error };
        const row = state.row;
        const matches = row && filters.every(([key, value]) => row[key] === value);
        return { data: matches ? Object.fromEntries(columns.map((key) => [key, row[key]])) : null, error: null };
      }),
    };
    return query;
  });
  return { state, from, interno: vi.fn() };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mock.from } }));
vi.mock("../internoEmbarque", () => ({ obtenerEmbarqueInterno: mock.interno }));

import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { AuthOperationChangedError, syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";
import { obtenerEmbarqueTarifaInfo } from "../tarifaInfo";

const SNAPSHOT = Object.freeze({ delta: 0, costos_refrescados: [], anterior: null, decision_original: "sustituida" });
const HISTORY = {
  tarifa_id_original: "tarifa-original-ya-inexistente",
  tarifa_id_aplicada: "tarifa-aplicada-ya-inexistente",
  tarifa_decision: "sustituida",
  tarifa_revalidada_en: "2026-09-30T12:00:00Z",
};
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
function session(userId = "u-1", organizationId = "org-1") {
  setAuthSnapshot({ userId, email: null, organizationId: null, organizationName: null, role: "super_admin", effectiveRole: "super_admin" });
  syncActiveOrganizationScope({ userId, organizationId });
}

beforeEach(() => {
  vi.clearAllMocks();
  session();
  mock.state.row = { id: "e-1", deleted_at: null, ...HISTORY };
  mock.state.error = null;
  mock.state.gate = null;
  mock.interno.mockReset().mockResolvedValue({ tarifa_delta_jsonb: SNAPSHOT });
});

describe("tarifaInfo: padre vigente y decisión histórica intacta", () => {
  it("conserva IDs, decisión, fecha y snapshot aunque ya no existan las tarifas", async () => {
    const result = await obtenerEmbarqueTarifaInfo("e-1");
    expect(result).toEqual({ ...HISTORY, tarifa_delta_jsonb: SNAPSHOT });
    expect(result?.tarifa_delta_jsonb).toBe(SNAPSHOT);
    expect(mock.from).toHaveBeenCalledExactlyOnceWith("embarques");
    expect(mock.interno).toHaveBeenCalledExactlyOnceWith("e-1");
    const query = mock.from.mock.results[0].value;
    expect(query.select).toHaveBeenCalledWith("tarifa_id_original, tarifa_id_aplicada, tarifa_decision, tarifa_revalidada_en");
    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it.each(["eliminado", "ausente", "otro id"])("devuelve null para padre %s sin consultar columnas internas", async (kind) => {
    if (kind === "eliminado") mock.state.row!.deleted_at = "2026-10-13T00:00:00Z";
    else if (kind === "ausente") mock.state.row = null;
    else mock.state.row!.id = "e-otro";
    await expect(obtenerEmbarqueTarifaInfo("e-1")).resolves.toBeNull();
    expect(mock.interno).not.toHaveBeenCalled();
  });

  it("no reutiliza la etiqueta del padre que fue eliminado entre consultas", async () => {
    await expect(obtenerEmbarqueTarifaInfo("e-1")).resolves.toMatchObject(HISTORY);
    mock.state.row!.deleted_at = "2026-10-13T00:00:00Z";
    await expect(obtenerEmbarqueTarifaInfo("e-1")).resolves.toBeNull();
    expect(mock.interno).toHaveBeenCalledTimes(1);
  });

  it.each([{ snapshot: 0 }, { snapshot: [] }, { snapshot: null }])("preserva literalmente el snapshot $snapshot", async ({ snapshot }) => {
    mock.interno.mockResolvedValue({ tarifa_delta_jsonb: snapshot });
    const result = await obtenerEmbarqueTarifaInfo("e-1");
    expect(result?.tarifa_delta_jsonb).toBe(snapshot);
    expect(result?.tarifa_decision).toBe("sustituida");
  });

  it("interno no disponible conserva null, nunca lo convierte en delta cero", async () => {
    mock.interno.mockResolvedValue(null);
    await expect(obtenerEmbarqueTarifaInfo("e-1")).resolves.toEqual({ ...HISTORY, tarifa_delta_jsonb: null });
  });

  it("conserva campos históricos null sin reconstruir una tarifa actual", async () => {
    for (const key of Object.keys(HISTORY)) mock.state.row![key] = null;
    mock.interno.mockResolvedValue(null);
    await expect(obtenerEmbarqueTarifaInfo("e-1")).resolves.toEqual({
      tarifa_id_original: null, tarifa_id_aplicada: null, tarifa_decision: null, tarifa_revalidada_en: null, tarifa_delta_jsonb: null,
    });
    expect(mock.from).toHaveBeenCalledExactlyOnceWith("embarques");
  });

  it("propaga error del padre sin leer información interna", async () => {
    const error = new Error("Padre no disponible");
    mock.state.error = error;
    await expect(obtenerEmbarqueTarifaInfo("e-1")).rejects.toBe(error);
    expect(mock.interno).not.toHaveBeenCalled();
  });

  it("propaga error interno sin fabricar un snapshot", async () => {
    const error = new Error("Vista interna no disponible");
    mock.interno.mockRejectedValue(error);
    await expect(obtenerEmbarqueTarifaInfo("e-1")).rejects.toBe(error);
  });

  it.each(["usuario", "organización", "ida y vuelta"])("rechaza cambio de %s durante la lectura del padre", async (kind) => {
    const gate = deferred();
    mock.state.gate = gate.promise;
    const pending = obtenerEmbarqueTarifaInfo("e-1");
    if (kind === "usuario") session("u-2");
    else session("u-1", "org-2");
    if (kind === "ida y vuelta") session();
    gate.resolve();
    await expect(pending).rejects.toBeInstanceOf(AuthOperationChangedError);
    expect(mock.interno).not.toHaveBeenCalled();
  });

  it.each(["usuario", "organización"])("rechaza cambio de %s durante la lectura interna", async (kind) => {
    const entered = deferred();
    const gate = deferred();
    mock.interno.mockImplementation(async () => { entered.resolve(); await gate.promise; return { tarifa_delta_jsonb: SNAPSHOT }; });
    const pending = obtenerEmbarqueTarifaInfo("e-1");
    await entered.promise;
    session(kind === "usuario" ? "u-2" : "u-1", "org-2");
    gate.resolve();
    await expect(pending).rejects.toBeInstanceOf(AuthOperationChangedError);
  });
});
