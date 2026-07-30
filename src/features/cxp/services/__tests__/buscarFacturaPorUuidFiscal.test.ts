/**
 * Tests de `buscarFacturaPorUuidFiscal` (v13.343.0).
 * Cubre: encuentra factura viva, filtra borradas y normaliza el UUID vacío.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { buscarFacturaPorUuidFiscal } from "../proveedorFacturas.crud";

const UUID = "80B5AAA2-4E21-426B-8806-830DAB6B2642";

describe("buscarFacturaPorUuidFiscal", () => {
  beforeEach(() => {
    mock.resetResults();
    mock.tableCalls.length = 0;
  });

  it("devuelve la factura viva que ya usa el UUID", async () => {
    mock.setTableResult("proveedor_facturas", {
      data: [{
        id: "f-1", folio_interno: "FP-000123", folio_proveedor: "9593",
        proveedor_nombre: "ADMINISTRACION GONG", estado: "Pagada", estado_aprobacion: "aprobada",
      }],
      error: null,
    });
    const res = await buscarFacturaPorUuidFiscal(`  ${UUID.toLowerCase()}  `);
    expect(res?.folio_interno).toBe("FP-000123");
    const call = mock.tableCalls[0];
    expect(call.table).toBe("proveedor_facturas");
    // El UUID se envía sin espacios y sólo se buscan filas no borradas.
    expect(call.opArgs[call.ops.indexOf("ilike")]).toEqual(["uuid_fiscal", UUID]);
    expect(call.opArgs[call.ops.indexOf("is")]).toEqual(["deleted_at", null]);
  });

  it("devuelve null cuando no hay factura viva con ese UUID", async () => {
    mock.setTableResult("proveedor_facturas", { data: [], error: null });
    expect(await buscarFacturaPorUuidFiscal(UUID)).toBeNull();
  });

  it("no consulta cuando el UUID viene vacío", async () => {
    expect(await buscarFacturaPorUuidFiscal("   ")).toBeNull();
    expect(mock.tableCalls).toHaveLength(0);
  });
});
