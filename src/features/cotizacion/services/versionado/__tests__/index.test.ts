import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  recotizarCotizacion,
  aceptarCotizacionVersion,
  obtenerCostosCotizacionVersion,
} from "@/features/cotizacion/services/versionado";
import {
  CotizacionConEmbarqueError,
  CotizacionYaAceptadaError,
  MotivoRequeridoError,
} from "@/features/cotizacion/domain/versionadoCotizacion";

beforeEach(() => {
  mock.rpcCalls.length = 0;
});

describe("recotizarCotizacion", () => {
  it("rechaza motivos vacíos sin invocar la RPC", async () => {
    await expect(recotizarCotizacion("cot-1", "   ")).rejects.toBeInstanceOf(MotivoRequeridoError);
    expect(mock.rpcCalls.length).toBe(0);
  });

  it("invoca la RPC y devuelve version_anterior/nueva", async () => {
    mock.setRpcResult("recotizar_cotizacion", {
      data: { cotizacion_id: "c1", version_anterior: 1, version_nueva: 2 },
      error: null,
    });
    const out = await recotizarCotizacion("c1", "Cliente pidió revisión");
    expect(out).toEqual({ version_anterior: 1, version_nueva: 2 });
    const call = mock.rpcCalls.find((c) => c.fn === "recotizar_cotizacion");
    expect(call?.args).toEqual({ p_cotizacion_id: "c1", p_motivo: "Cliente pidió revisión" });
  });

  it("propaga error de la RPC recotizar_cotizacion", async () => {
    mock.setRpcResult("recotizar_cotizacion", { data: null, error: { message: "boom" } });
    await expect(recotizarCotizacion("c1", "x")).rejects.toThrow("boom");
  });
});

describe("aceptarCotizacionVersion", () => {
  it("devuelve la versión aceptada", async () => {
    mock.setRpcResult("aceptar_cotizacion_version", {
      data: { cotizacion_id: "c1", version_aceptada: 3 },
      error: null,
    });
    const out = await aceptarCotizacionVersion("c1");
    expect(out.version_aceptada).toBe(3);
  });

  it("traduce código 22023 a CotizacionYaAceptadaError", async () => {
    mock.setRpcResult("aceptar_cotizacion_version", {
      data: null,
      error: { message: "ya aceptada", code: "22023" },
    });
    await expect(aceptarCotizacionVersion("c1")).rejects.toBeInstanceOf(CotizacionYaAceptadaError);
  });
});

describe("obtenerCostosCotizacionVersion", () => {
  it("parsea filas crudas a CostoVersionado", async () => {
    mock.setRpcResult("obtener_costos_cotizacion_version", {
      data: [
        { id: "x", cotizacion_id: "c1", concepto: "Flete", moneda: "USD", costo_unitario: 100, precio_venta: 120 },
      ],
      error: null,
    });
    const out = await obtenerCostosCotizacionVersion("c1", 1);
    expect(out).toHaveLength(1);
    expect(out[0].concepto).toBe("Flete");
    expect(out[0].costo_total).toBe(100);
  });

  it("devuelve [] cuando data no es array", async () => {
    mock.setRpcResult("obtener_costos_cotizacion_version", { data: null, error: null });
    const out = await obtenerCostosCotizacionVersion("c1");
    expect(out).toEqual([]);
  });
});

describe("versionado/index.ts - extra coverage", () => {
  it("aceptarCotizacionVersion lanza error genérico si no es 22023", async () => {
    mock.setRpcResult("aceptar_cotizacion_version", {
      data: null,
      error: { message: "error fatal", code: "P0001" },
    });
    await expect(aceptarCotizacionVersion("c1")).rejects.toThrow("error fatal");
  });

  it("obtenerCostosCotizacionVersion lanza error si falla la RPC", async () => {
    mock.setRpcResult("obtener_costos_cotizacion_version", { data: null, error: { message: "fail" } });
    await expect(obtenerCostosCotizacionVersion("c1")).rejects.toThrow("fail");
  });

  it("parseCosto cubre todas las ramas de nullish coalescing", async () => {
    mock.setRpcResult("obtener_costos_cotizacion_version", {
      data: [{}], // objeto vacío para forzar defaults
      error: null,
    });
    const out = await obtenerCostosCotizacionVersion("c1");
    expect(out[0].moneda).toBe("USD");
    expect(out[0].cantidad).toBe(0);
    expect(out[0].costo_total).toBe(0);
    expect(out[0].precio_total).toBe(0);
  });

  it("parseCosto usa version null si no viene", async () => {
    mock.setRpcResult("obtener_costos_cotizacion_version", {
      data: [{ version: null }],
      error: null,
    });
    const out = await obtenerCostosCotizacionVersion("c1");
    expect(out[0].version).toBeNull();
  });
});
