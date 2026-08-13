import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchProveedorInteligencia } from "@/features/proveedor/services/proveedorInteligencia";

beforeEach(() => {
  mock.rpcCalls.length = 0;
});

describe("fetchProveedorInteligencia", () => {
  it("mapea el jsonb de la RPC al shape del dominio", async () => {
    mock.setRpcResult("proveedor_inteligencia", {
      data: {
        tc: { usd_mxn: 18.5, eur_mxn: 20.1, faltante: false },
        tipo_proveedor: "Naviera",
        scorecard: {
          partidas_total: 10,
          partidas_facturadas: 4,
          comprometido_mxn: 1000,
          facturado_mxn: 420,
          comprometido_ligado_mxn: 400,
          dias_facturacion_prom: 5.5,
          facturas_count: 3,
          ticket_promedio_mxn: 140,
          top_conceptos: [{ concepto: "Flete", monto_mxn: 900, partidas: 6 }],
          top_rutas: [{ ruta: "CNSHA → MXZLO", monto_mxn: 900, embarques: 2 }],
        },
        tendencia: [{ mes: "2026-01", comprometido: 100, facturado: 80, pagado: 50 }],
        comparativo: [{
          concepto: "Flete", moneda: "USD", unitario_propio: 120, ops_propias: 5,
          unitario_otros: 100, ops_otros: 7, proveedores_comparados: 3,
        }],
        alertas: {
          cerrados_sin_factura: { count: 2, monto_mxn: 300 },
          facturas_por_vencer: { count: 1, monto_mxn: 100 },
          facturas_vencidas: { count: 0, monto_mxn: 0 },
          saldo_pendiente_mxn: 400,
          bancarios_incompletos: true,
          documentos_vencidos: 1,
          documentos_por_vencer: 2,
        },
      },
      error: null,
    });

    const r = await fetchProveedorInteligencia("p1");

    expect(mock.rpcCalls.at(-1)).toMatchObject({
      fn: "proveedor_inteligencia",
      args: { p_proveedor_id: "p1" },
    });
    expect(r.tipoProveedor).toBe("Naviera");
    expect(r.tc).toEqual({ usdMxn: 18.5, eurMxn: 20.1, faltante: false });
    expect(r.scorecard.partidasFacturadas).toBe(4);
    expect(r.scorecard.diasFacturacionProm).toBe(5.5);
    expect(r.scorecard.topConceptos[0]).toEqual({ concepto: "Flete", montoMxn: 900, partidas: 6 });
    expect(r.scorecard.topRutas[0].ruta).toBe("CNSHA → MXZLO");
    expect(r.tendencia[0]).toEqual({ mes: "2026-01", comprometido: 100, facturado: 80, pagado: 50 });
    expect(r.comparativo[0]).toMatchObject({ opsPropias: 5, opsOtros: 7, unitarioPropio: 120 });
    expect(r.alertas.bancariosIncompletos).toBe(true);
    expect(r.alertas.cerradosSinFactura).toEqual({ count: 2, montoMxn: 300 });
  });

  it("tolera un payload vacío sin romper", async () => {
    mock.setRpcResult("proveedor_inteligencia", { data: null, error: null });
    const r = await fetchProveedorInteligencia("p1");
    expect(r.scorecard.partidasTotal).toBe(0);
    expect(r.scorecard.diasFacturacionProm).toBeNull();
    expect(r.tendencia).toEqual([]);
    expect(r.comparativo).toEqual([]);
    expect(r.alertas.bancariosIncompletos).toBe(false);
    expect(r.tipoProveedor).toBeNull();
  });

  it("propaga el error de la RPC", async () => {
    mock.setRpcResult("proveedor_inteligencia", {
      data: null,
      error: { message: "LC_ORG_SIN_CONTEXTO: no hay organización activa" },
    });
    await expect(fetchProveedorInteligencia("p1")).rejects.toMatchObject({
      message: "LC_ORG_SIN_CONTEXTO: no hay organización activa",
    });
  });
});
