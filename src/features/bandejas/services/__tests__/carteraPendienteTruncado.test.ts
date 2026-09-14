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

import { fetchCarteraPendiente, CARTERA_PENDIENTE_LIMITE } from "../bandejas";

const fila = (i: number) => ({ factura_id: `f-${i}`, moneda: "MXN", total: 100, saldo: 100 });

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
});
