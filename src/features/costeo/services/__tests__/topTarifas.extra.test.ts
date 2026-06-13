import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TopTarifasParams } from "../topTarifas";
import type { TopTarifaRow, CosteoTarifaRecargo } from "@/features/costeo/types";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchTopTarifas, fetchRecargosDeTarifa } from "../topTarifas";

const RPC = "get_top_tarifas";
const RECARGOS = "costeo_tarifa_recargos";
const baseParams: TopTarifasParams = { puertoOrigenId: "po-1", puertoDestinoId: "pd-1", tipoContenedorId: "tc-1" };

function makeTopRow(o: Partial<TopTarifaRow> = {}): TopTarifaRow {
  return { id:"t-1", organization_id:"org-1", agente_id:"ag-1", agente_nombre:"Agente X", dias_credito:30,
    naviera_id:"nav-1", naviera_nombre:"Nav Y", ruta_id:"ru-1", puerto_origen_id:"po-1", puerto_destino_id:"pd-1",
    puerto_origen_nombre:"SHA", puerto_destino_nombre:"MZT", tipo_contenedor_id:"tc-1", tipo_contenedor_nombre:"20'",
    moneda:"USD", flete_base:1000, recargos_total:200, total_comparable:1200, dias_libres_demoras:14,
    transit_time_dias:28, vigente_desde:"2026-01-01", vigente_hasta:"2026-12-31", estado:"vigente",
    naviera_condicion_id:null, naviera_tiene_carta_garantia:false, naviera_carta_garantia_vigente_hasta:null,
    naviera_carta_garantia_activa:false, naviera_dias_libres_default:null, naviera_demora_dia_6:null, ...o };
}

beforeEach(() => { mock.tableCalls.length = 0; mock.rpcCalls.length = 0; });

describe("costeo/topTarifas (extra)", () => {
  it("01 — fetchTopTarifas: llama al RPC con los parámetros correctos", async () => {
    mock.setRpcResult(RPC, { data: [], error: null });
    await fetchTopTarifas(baseParams);
    expect(mock.rpcCalls[0].fn).toBe(RPC);
    const args = mock.rpcCalls[0].args as Record<string, string>;
    expect(args.p_puerto_origen_id).toBe("po-1");
  });

  it("02 — fetchTopTarifas: retorna arreglo vacío cuando data es null", async () => {
    mock.setRpcResult(RPC, { data: null, error: null });
    expect(await fetchTopTarifas(baseParams)).toEqual([]);
  });

  it("03 — fetchTopTarifas: retorna filas del RPC", async () => {
    mock.setRpcResult(RPC, { data: [makeTopRow(), makeTopRow({ id:"t-2", flete_base:800 })], error: null });
    const res = await fetchTopTarifas(baseParams);
    expect(res).toHaveLength(2);
    expect(res[1].flete_base).toBe(800);
  });

  it("04 — fetchTopTarifas: lanza error si RPC falla", async () => {
    mock.setRpcResult(RPC, { data: null, error: new Error("rpc fail") });
    await expect(fetchTopTarifas(baseParams)).rejects.toThrow("rpc fail");
  });

  it("05 — fetchTopTarifas: usa fecha provista en parámetros", async () => {
    mock.setRpcResult(RPC, { data: [], error: null });
    await fetchTopTarifas({ ...baseParams, fecha: "2026-03-15" });
    const args = mock.rpcCalls[0].args as Record<string, string>;
    expect(args.p_fecha).toBe("2026-03-15");
  });

  it("06 — fetchTopTarifas: pasa organizationId cuando se provee", async () => {
    mock.setRpcResult(RPC, { data: [], error: null });
    await fetchTopTarifas({ ...baseParams, organizationId: "org-42" });
    const args = mock.rpcCalls[0].args as Record<string, string>;
    expect(args.p_organization_id).toBe("org-42");
  });

  it("07 — fetchRecargosDeTarifa: llama tabla correcta con eq", async () => {
    mock.setTableResult(RECARGOS, { data: [], error: null });
    await fetchRecargosDeTarifa("tarifa-abc");
    expect(mock.tableCalls[0].table).toBe(RECARGOS);
    const eqIdx = mock.tableCalls[0].ops.indexOf("eq");
    expect(mock.tableCalls[0].opArgs[eqIdx]).toEqual(["tarifa_id", "tarifa-abc"]);
  });

  it("08 — fetchRecargosDeTarifa: retorna vacío cuando data es null", async () => {
    mock.setTableResult(RECARGOS, { data: null, error: null });
    expect(await fetchRecargosDeTarifa("x")).toEqual([]);
  });

  it("09 — fetchRecargosDeTarifa: retorna los recargos correctamente", async () => {
    const rows = [{ id:"r-1", tarifa_id:"t-1", concepto:"BAF", lado:"origen", monto:50, moneda:"USD" },
                  { id:"r-2", tarifa_id:"t-1", concepto:"CAF", lado:"destino", monto:80, moneda:"USD" }] as CosteoTarifaRecargo[];
    mock.setTableResult(RECARGOS, { data: rows, error: null });
    const res = await fetchRecargosDeTarifa("t-1");
    expect(res).toHaveLength(2);
    expect(res[1].concepto).toBe("CAF");
  });

  it("10 — fetchRecargosDeTarifa: lanza error si Supabase falla", async () => {
    mock.setTableResult(RECARGOS, { data: null, error: new Error("select fail") });
    await expect(fetchRecargosDeTarifa("t-1")).rejects.toThrow("select fail");
  });
});
