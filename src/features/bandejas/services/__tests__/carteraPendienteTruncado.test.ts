/**
 * N10 (v13.823.390) — `public.cartera_pendiente()` termina en LIMIT 500. La
 * pantalla no debe presentar ese corte como la cartera completa: se acompaña
 * del conteo real y se marca `truncado`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { derivarLoteCobro } from "../../routes/_sections/carteraLote";
import { fetchCarteraPendiente, CARTERA_PENDIENTE_LIMITE } from "../bandejas";

const fila = (i: number) => ({ factura_id: `f-${i}`, moneda: "MXN", total: 100, saldo: 100, pagado: 0 });

describe("fetchCarteraPendiente — señal de truncamiento", () => {
  beforeEach(() => {
    mock.resetResults();
  });

  it("marca truncado cuando la base tiene más facturas que el tope", async () => {
    mock.setRpcResult("cartera_pendiente", {
      data: Array.from({ length: CARTERA_PENDIENTE_LIMITE }, (_, i) => fila(i)),
      error: null,
    });
    mock.setRpcResult("cartera_pendiente_total", { data: 812, error: null });
    const r = await fetchCarteraPendiente();
    expect(r.rows).toHaveLength(CARTERA_PENDIENTE_LIMITE);
    expect(r.total).toBe(812);
    expect(r.truncado).toBe(true);
  });

  it("no marca truncado cuando cabe completa", async () => {
    mock.setRpcResult("cartera_pendiente", { data: [fila(1), fila(2)], error: null });
    mock.setRpcResult("cartera_pendiente_total", { data: 2, error: null });
    const r = await fetchCarteraPendiente();
    expect(r.truncado).toBe(false);
    expect(r.total).toBe(2);
  });

  it("propaga el error del conteo (nunca un total inventado)", async () => {
    mock.setRpcResult("cartera_pendiente", { data: [fila(1)], error: null });
    mock.setRpcResult("cartera_pendiente_total", {
      data: null,
      error: { message: "permission denied" },
    });
    await expect(fetchCarteraPendiente()).rejects.toMatchObject({
      message: "permission denied",
    });
  });
  it("AUD116: conserva método fiscal de cada factura hasta las candidatas de lote", async () => {
    const rows = [1, 2].map((i) => ({ ...fila(i), cliente_id: "c1", cliente_nombre: "Cliente", fecha_emision: "2026-10-01" }));
    mock.setRpcResult("cartera_pendiente", { data: rows, error: null });
    mock.setRpcResult("cartera_pendiente_total", { data: 2, error: null });
    mock.setTableResult("facturas", { data: [{ id: "f-1", metodo_pago: "PUE", uuid_fiscal: "uuid1" }, { id: "f-2", metodo_pago: "PPD", uuid_fiscal: "uuid2" }], error: null });
    const r = await fetchCarteraPendiente();
    const lote = derivarLoteCobro(r.rows);
    expect(lote?.facturas.map((f) => f.metodo_pago)).toEqual(["PUE", "PPD"]);
    expect(lote?.facturas.map((f) => f.es_ppd_timbrada)).toEqual([false, true]);
    expect(lote?.facturas[0].fecha_emision).toBe("2026-10-01");
  });

  it("AUD116: no muestra preflight como confiable si falla la lectura fiscal", async () => {
    mock.setRpcResult("cartera_pendiente", { data: [fila(1)], error: null });
    mock.setRpcResult("cartera_pendiente_total", { data: 1, error: null });
    mock.setTableResult("facturas", { data: null, error: { message: "fiscal offline" } });
    await expect(fetchCarteraPendiente()).rejects.toMatchObject({ message: "fiscal offline" });
  });

});
