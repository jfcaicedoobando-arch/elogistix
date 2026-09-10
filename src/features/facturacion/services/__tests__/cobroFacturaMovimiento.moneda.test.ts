/**
 * Ola v17 — el abono bancario del cobro se crea SÓLO por la RPC
 * `asegurar_movimiento_cobro_factura` (punto único de escritura, idempotente y
 * con la conversión de moneda del lado del servidor).
 * Antes esta prueba cubría la conversión en el cliente; ahora cubre el contrato
 * de la RPC y que el error deje de tragarse.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("@/lib/observability/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const { crearMovimientoBancarioCobro } = await import("../cobroFacturaMovimiento");

describe("crearMovimientoBancarioCobro · punto único de escritura", () => {
  beforeEach(() => rpc.mockReset());

  it("llama a la RPC con el id del cobro y reporta el abono creado", async () => {
    rpc.mockResolvedValue({ data: { creado: true, movimiento_id: "mov-1", abono: 5000 }, error: null });
    const res = await crearMovimientoBancarioCobro("pago-1");
    expect(rpc).toHaveBeenCalledWith("asegurar_movimiento_cobro_factura", { p_pago_id: "pago-1" });
    expect(res).toEqual({ ok: true, motivo: undefined, movimientoId: "mov-1" });
  });

  it("es idempotente: si ya existe no reporta creación", async () => {
    rpc.mockResolvedValue({ data: { creado: false, motivo: "ya_existe", movimiento_id: "mov-1" }, error: null });
    const res = await crearMovimientoBancarioCobro("pago-1");
    expect(res.ok).toBe(false);
    expect(res.motivo).toBe("ya_existe");
  });

  it("propaga el motivo cuando la cuenta y el cobro difieren de moneda sin TC", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "LC_PAGO_TC_REQUERIDO: captura el tipo de cambio" } });
    const res = await crearMovimientoBancarioCobro("pago-1");
    expect(res.ok).toBe(false);
    expect(res.motivo).toContain("LC_PAGO_TC_REQUERIDO");
  });

  it("no reporta creación cuando el cobro no trae cuenta bancaria", async () => {
    rpc.mockResolvedValue({ data: { creado: false, motivo: "sin_cuenta_bancaria" }, error: null });
    const res = await crearMovimientoBancarioCobro("pago-1");
    expect(res).toEqual({ ok: false, motivo: "sin_cuenta_bancaria", movimientoId: undefined });
  });
});
