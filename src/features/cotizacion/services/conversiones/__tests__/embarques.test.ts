import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  convertirCotizacionAEmbarques,
  crearEmbarqueBorradorDesdeCotizacion,
} from "@/features/cotizacion/services/conversiones/embarques";
import type { CotizacionRow } from "@/features/cotizacion/types";

function makeCot(overrides: Partial<CotizacionRow> = {}): CotizacionRow {
  return {
    id: "cot-1",
    cliente_id: "cli-1",
    cliente_nombre: "Acme",
    tipo_documento: "real",
    modo: "Marítimo",
    tipo: "Importación",
    incoterm: "FOB",
    descripcion_mercancia: "carga seca",
    peso_kg: 1000,
    volumen_m3: 30,
    piezas: 100,
    operador: "Operador",
    tipo_carga: "FCL",
    tipo_contenedor: "40HC",
    num_contenedores: 2,
    conceptos_venta: [],
    ...overrides,
  } as unknown as CotizacionRow;
}

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
});

describe("convertirCotizacionAEmbarques", () => {
  it("rechaza cotizaciones informativas (tarifarios)", async () => {
    await expect(
      convertirCotizacionAEmbarques(makeCot({ tipo_documento: "informativa" })),
    ).rejects.toThrow(/informativas/i);
  });

  it("crea embarque + N contenedores hijos y actualiza la cotización", async () => {
    mock.setTableResult("cotizacion_costos", { data: [], error: null });
    mock.setRpcResult("generar_expediente", { data: "EXP-001", error: null });
    mock.setTableResult("embarques", { data: { id: "emb-1" }, error: null });
    mock.setTableResult("embarque_contenedores", {
      data: [
        { id: "h1", orden: 1 },
        { id: "h2", orden: 2 },
      ],
      error: null,
    });
    mock.setTableResult("cotizaciones", { data: null, error: null });

    const result = await convertirCotizacionAEmbarques(makeCot({ num_contenedores: 2 }));

    expect(result).toEqual([{ id: "emb-1" }]);
    const hijosInsert = mock.getMutationPayload("embarque_contenedores", "insert");
    expect(Array.isArray(hijosInsert)).toBe(true);
    expect((hijosInsert as unknown[]).length).toBe(2);

    const updateCot = mock.getMutationPayload("cotizaciones", "update") as Record<string, unknown>;
    expect(updateCot.estado).toBe("En operación");
    expect(updateCot.embarque_id).toBe("emb-1");
  });

  it("propaga el error al generar expediente", async () => {
    mock.setTableResult("cotizacion_costos", { data: [], error: null });
    mock.setRpcResult("generar_expediente", { data: null, error: new Error("rpc-fail") });
    await expect(convertirCotizacionAEmbarques(makeCot())).rejects.toThrow("rpc-fail");
  });
});

describe("crearEmbarqueBorradorDesdeCotizacion", () => {
  it("rechaza si la cotización es informativa", async () => {
    mock.setTableResult("cotizaciones", {
      data: { tipo_documento: "informativa" },
      error: null,
    });
    await expect(crearEmbarqueBorradorDesdeCotizacion("cot-x")).rejects.toThrow(/informativas/i);
  });

  it("invoca la RPC y devuelve el id del embarque", async () => {
    mock.setTableResult("cotizaciones", { data: { tipo_documento: "real" }, error: null });
    mock.setRpcResult("crear_embarque_borrador_desde_cotizacion", {
      data: "emb-99",
      error: null,
    });
    const id = await crearEmbarqueBorradorDesdeCotizacion("cot-1");
    expect(id).toBe("emb-99");
    expect(mock.rpcCalls.some((c) => c.fn === "crear_embarque_borrador_desde_cotizacion")).toBe(true);
  });

  it("falla si la RPC no devuelve id", async () => {
    mock.setTableResult("cotizaciones", { data: { tipo_documento: "real" }, error: null });
    mock.setRpcResult("crear_embarque_borrador_desde_cotizacion", { data: null, error: null });
    await expect(crearEmbarqueBorradorDesdeCotizacion("cot-1")).rejects.toThrow();
  });
});
