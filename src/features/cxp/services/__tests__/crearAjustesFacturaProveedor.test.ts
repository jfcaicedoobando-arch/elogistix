import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { crearAjustesFacturaProveedor } from "../crearAjustesFacturaProveedor";
import type { VinculoLinea } from "@/features/cxp/hooks/useNuevaFacturaProveedorForm.helpers";

const baseInput = {
  facturaId: "f1",
  organizationId: "org-1",
  folio: "FP-000039",
  fechaEmision: "2026-07-21",
  moneda: "USD" as const,
  proveedorId: "p1",
  proveedorNombre: "Acme",
};

const v = (embarqueId: string, desc: string, monto: number, montoOriginal: number): VinculoLinea => ({
  embarqueId,
  descripcion: desc,
  monto,
  montoOriginal,
});

describe("crearAjustesFacturaProveedor", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.rpcCalls.length = 0;
    mock.resetResults();
  });

  it("no crea ajustes cuando no hay deltas > 0.01", async () => {
    const r = await crearAjustesFacturaProveedor({
      ...baseInput,
      vinculos: { c1: v("e1", "Flete", 1000, 1000), c2: v("e1", "THC", 500.005, 500) },
    });
    expect(r.ajustesCreados).toBe(0);
  });

  it("crea ajuste negativo cuando factura < devengado (descuento FP-000039)", async () => {
    mock.setRpcResult("crear_ajustes_factura_proveedor_rpc", {
      data: { ajustes_creados: 1, folio: "FP-000039" }, error: null,
    });
    const r = await crearAjustesFacturaProveedor({
      ...baseInput,
      vinculos: { c1: v("e1", "Flete Marítimo", 18639.60, 19150.00) },
    });
    expect(r.ajustesCreados).toBe(1);
    // P1: los ajustes se crean dentro de la RPC atómica.
    const call = mock.rpcCalls.find((c) => c.fn === "crear_ajustes_factura_proveedor_rpc");
    const args = call?.args as { p_factura_id: string; p_ajustes: Array<Record<string, unknown>> };
    expect(args.p_factura_id).toBe("f1");
    expect(args.p_ajustes[0]).toMatchObject({ embarque_id: "e1", descripcion: "Flete Marítimo" });
    expect(Number(args.p_ajustes[0].monto)).toBeCloseTo(-510.4, 2);
  });

  it("crea ajuste positivo cuando factura > devengado", async () => {
    mock.setRpcResult("crear_ajustes_factura_proveedor_rpc", {
      data: { ajustes_creados: 1, folio: "FP-000039" }, error: null,
    });
    const r = await crearAjustesFacturaProveedor({
      ...baseInput,
      vinculos: { c1: v("e1", "Flete", 21000, 20000) },
    });
    expect(r.ajustesCreados).toBe(1);
    const call = mock.rpcCalls.find((c) => c.fn === "crear_ajustes_factura_proveedor_rpc");
    const args = call?.args as { p_ajustes: Array<Record<string, unknown>> };
    expect(Number(args.p_ajustes[0].monto)).toBeCloseTo(1000, 2);
  });

  it("crea múltiples ajustes agrupados por vínculo", async () => {
    mock.setRpcResult("crear_ajustes_factura_proveedor_rpc", {
      data: { ajustes_creados: 2, folio: "FP-000039" }, error: null,
    });
    const r = await crearAjustesFacturaProveedor({
      ...baseInput,
      vinculos: {
        c1: v("e1", "Flete", 900, 1000),
        c2: v("e2", "THC", 550, 500),
      },
    });
    expect(r.ajustesCreados).toBe(2);
  });
});
