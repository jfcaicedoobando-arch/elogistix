/**
 * v13.823.357 (Auditoría YAGNI P1 #5): los códigos `LC_*` nuevos de la
 * conversión cotización → embarque se traducen a mensajes operatorios.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

const revalidarTarifaMock = vi.fn();
vi.mock("@/features/cotizacion/services/revalidacion", () => ({
  revalidarTarifa: (...args: unknown[]) => revalidarTarifaMock(...args),
}));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn() }));

import { crearEmbarqueBorradorDesdeCotizacion } from "../embarques";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
  mock.resetResults();
  revalidarTarifaMock.mockReset();
  revalidarTarifaMock.mockResolvedValue({ severidad: "sin_cambios" });
  mock.setTableResult("cotizaciones", { data: { tipo_documento: "formal" }, error: null });
});

const CASOS: [string, RegExp][] = [
  ["LC_COTIZACION_ELIMINADA: eliminada", /eliminada/i],
  ["LC_AGENTE_ORG_INVALIDA: agente de otra org", /agente/i],
  ["LC_COT_SIN_VENTA: sin venta positiva", /concepto de venta/i],
  ["LC_COT_VENTA_NO_REFLEJADA: costo sin venta", /paso 3/i],
  ["LC_COT_VENTA_IMPORTE_INVALIDO: cantidad 0", /cantidad o precio/i],
  ["LC_COT_MONEDA_NO_SOPORTADA: EUR", /pesos \(MXN\) y dólares \(USD\)/i],
];

describe("mapeo de errores LC_* al crear embarque", () => {
  for (const [mensajeRpc, esperado] of CASOS) {
    it(`traduce ${mensajeRpc.split(":")[0]}`, async () => {
      mock.setRpcResult("crear_embarque_borrador_desde_cotizacion", {
        data: null,
        error: { message: mensajeRpc },
      });
      await expect(crearEmbarqueBorradorDesdeCotizacion("cot-1")).rejects.toThrow(esperado);
    });
  }
});
