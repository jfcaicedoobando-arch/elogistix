/**
 * COT-DEL-01: la bitácora de "eliminar" sólo se escribe si el soft delete
 * realmente afectó a la cotización.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

const registrarActividad = vi.fn();
vi.mock("@/services/bitacora/registrar", () => ({
  registrarActividad: (...args: unknown[]) => registrarActividad(...args),
}));

import { deleteCotizacion } from "../delete";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.resetResults();
  registrarActividad.mockClear();
});

describe("deleteCotizacion", () => {
  it("happy path: confirma el borrado y registra actividad", async () => {
    mock.setTableResultOnce("cotizaciones", { data: { id: "cot-1" }, error: null });
    mock.setTableResultOnce("cotizaciones", { data: null, error: null });
    mock.setRpcResult("soft_delete_record", { data: null, error: null });
    await expect(deleteCotizacion("cot-1")).resolves.toBeUndefined();
    expect(registrarActividad).toHaveBeenCalledTimes(1);
  });

  it("no toca la RPC ni la bitácora si la cotización no existe/no es visible", async () => {
    mock.setTableResultOnce("cotizaciones", { data: null, error: null });
    await expect(deleteCotizacion("cot-x")).rejects.toThrow(/no tienes permiso|ya no existe/i);
    expect(registrarActividad).not.toHaveBeenCalled();
  });

  it("no registra actividad si la fila sigue viva después de la RPC (no-op)", async () => {
    mock.setTableResultOnce("cotizaciones", { data: { id: "cot-1" }, error: null });
    mock.setTableResultOnce("cotizaciones", { data: { id: "cot-1" }, error: null });
    mock.setRpcResult("soft_delete_record", { data: null, error: null });
    await expect(deleteCotizacion("cot-1")).rejects.toThrow(/no tienes permiso|ya no existe/i);
    expect(registrarActividad).not.toHaveBeenCalled();
  });

  it("propaga el error real de la RPC", async () => {
    mock.setTableResultOnce("cotizaciones", { data: { id: "cot-1" }, error: null });
    mock.setRpcResult("soft_delete_record", {
      data: null,
      error: { message: "LC_BAJA_CON_DEPENDENCIAS" },
    });
    await expect(deleteCotizacion("cot-1")).rejects.toMatchObject({
      message: "LC_BAJA_CON_DEPENDENCIAS",
    });
    expect(registrarActividad).not.toHaveBeenCalled();
  });
});
