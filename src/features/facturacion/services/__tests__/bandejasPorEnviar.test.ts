/**
 * Paridad entre la LISTA "Por enviar" y su CONTEO.
 *
 * Antes el conteo restaba `count(timbradas) - DISTINCT(envíos)` y la lista
 * excluía "Vencida", así que badge y bandeja se contradecían. Ahora ambos
 * comparten `ESTADOS_TIMBRADAS_ENVIABLES` y el conteo es un anti-join real.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  ESTADOS_TIMBRADAS_ENVIABLES,
  fetchFacturasPorEnviar,
} from "@/features/facturacion/services/bandejasQueries";
import { fetchBandejaConteos } from "@/features/facturacion/services/bandejasConteos";

const factura = (id: string, estado: string) => ({
  id, numero: `FAC-${id}`, cliente_id: "c1", cliente_nombre: "ACME",
  total: 100, moneda: "MXN", fecha_emision: "2026-01-01", uuid_fiscal: `uuid-${id}`,
  estado,
});

beforeEach(() => {
  mock.resetResults();
  mock.tableCalls.length = 0;
});

describe("bandeja Por enviar", () => {
  it("incluye 'Vencida' en el canon de estados enviables", () => {
    expect(ESTADOS_TIMBRADAS_ENVIABLES).toContain("Vencida");
  });

  it("la lista excluye las que ya tienen envío exitoso", async () => {
    mock.setTableResult("facturas", { data: [factura("1", "Emitida"), factura("2", "Vencida")], error: null });
    mock.setTableResult("factura_envios", { data: [{ factura_id: "1" }], error: null });
    const filas = await fetchFacturasPorEnviar("org1");
    expect(filas.map((f) => f.id)).toEqual(["2"]);
  });

  it("el conteo coincide con la lista (anti-join, incluye Vencida)", async () => {
    // orden de `from()`: porTimbrar, timbradas(ids), envíos, porCobrar, vencidas, pagos
    mock.setTableResultOnce("facturas", { data: [], error: null, count: 0 } as never);
    mock.setTableResultOnce("facturas", { data: [{ id: "1" }, { id: "2" }], error: null });
    mock.setTableResult("factura_envios", { data: [{ factura_id: "1" }], error: null });
    mock.setTableResultOnce("facturas", { data: [], error: null, count: 0 } as never);
    mock.setTableResultOnce("facturas", { data: [], error: null, count: 0 } as never);
    mock.setTableResult("pagos_factura", { data: [], error: null, count: 0 } as never);
    const c = await fetchBandejaConteos("org1");
    expect(c.porEnviar).toBe(1);
  });

  it("propaga el error de una cubeta en vez de reportar 0", async () => {
    mock.setTableResult("facturas", { data: null, error: { message: "boom" } });
    mock.setTableResult("factura_envios", { data: [], error: null });
    mock.setTableResult("pagos_factura", { data: [], error: null, count: 0 } as never);
    await expect(fetchBandejaConteos("org1")).rejects.toThrow(/boom/);
  });
});
