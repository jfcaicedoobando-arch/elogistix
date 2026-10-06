import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc, registrar } = vi.hoisted(() => ({ rpc: vi.fn(), registrar: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: registrar }));
import { ejecutarPagoProgramado } from "../ejecutarPagoProgramado";
const input = { facturaId: "fp", cuentaBancariaId: "stale-bank", fecha: "2026-10-01", monto: 1, moneda: "USD", tipoCambio: 18.1903, metodoPago: "Efectivo", requestId: "same-key" };
describe("AUD103/108 payload RPC", () => {
  beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({ data: { pago_id: "p", movimiento_id: null, saldo_cuenta_restante: null }, error: null }); });
  it("cash ignores stale account and persists confirmed FX and stable request", async () => {
    expect(await ejecutarPagoProgramado(input)).toMatchObject({ movimiento_id: null, saldo_cuenta_restante: null });
    expect(rpc).toHaveBeenCalledWith("ejecutar_pago_programado", expect.objectContaining({ p_cuenta_bancaria_id: null, p_tipo_cambio: 18.1903, p_request_id: "same-key" }));
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ detalles: expect.objectContaining({ cuenta_bancaria_id: null, tipo_cambio: 18.1903 }) }));
  });
  it("noncash retains its selected account and manual TC", async () => {
    await ejecutarPagoProgramado({ ...input, metodoPago: "Transferencia", tipoCambio: 20 });
    expect(rpc).toHaveBeenCalledWith("ejecutar_pago_programado", expect.objectContaining({ p_cuenta_bancaria_id: "stale-bank", p_tipo_cambio: 20 }));
  });
  it("foreign payment without FX and future date never reach the RPC", async () => {
    await expect(ejecutarPagoProgramado({ ...input, tipoCambio: null })).rejects.toThrow(/tipo de cambio/);
    await expect(ejecutarPagoProgramado({ ...input, fecha: "2099-01-01" })).rejects.toThrow(/futura/);
    expect(rpc).not.toHaveBeenCalled();
  });
});
