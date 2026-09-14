/**
 * N1 (v13.823.386) — el listado de CxP toma el saldo del servidor
 * (`v_proveedor_facturas_saldo`), que convierte pagos y notas de crédito a la
 * moneda de la factura. Antes se sumaba `monto` crudo y una factura MXN con
 * nota de crédito en USD mostraba un saldo equivocado.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mapJoinedRow } from "../proveedorFacturas.helpers";
import type { Joined } from "../proveedorFacturas.types";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchFacturasCxP } from "../proveedorFacturas";

function joined(over: Partial<Joined> = {}): Joined {
  return {
    id: "pf-1",
    proveedor_id: "pr-1",
    proveedor_nombre: "Naviera SA",
    embarque_id: null,
    folio_proveedor: "A-1",
    folio_interno: "FP-000001",
    fecha_emision: "2026-09-01",
    fecha_vencimiento: "2026-10-01",
    moneda: "MXN",
    subtotal: 1000,
    iva: 0,
    ieps: 0,
    retenciones: 0,
    total: 1000,
    estado: "Vigente",
    tipo_cambio_usd: 1,
    rfc_proveedor: null,
    uuid_fiscal: null,
    dias_credito: 30,
    notas: null,
    estado_aprobacion: "aprobada",
    motivo_rechazo: null,
    categoria_presupuesto_id: null,
    archivo_xml_url: null,
    archivo_pdf_url: null,
    uuid_verificado: false,
    uuid_verificado_fecha: null,
    uuid_estatus_sat: null,
    fecha_programada_pago: null,
    fecha_cancelacion: null,
    motivo_cancelacion: null,
    cancelada_por: null,
    created_by: null,
    // Nota de crédito de 20 USD: sumar `monto` crudo daría 980 de saldo.
    pagos_proveedor: [],
    proveedor_notas_credito: [{ monto: 20, estado: "Aplicada", deleted_at: null }],
    proveedores: null,
    embarques: null,
    presupuesto_categorias: null,
    ...over,
  } as Joined;
}

describe("mapJoinedRow · saldo del servidor (N1)", () => {
  it("usa la nota de crédito convertida a la moneda de la factura", () => {
    const row = mapJoinedRow(joined(), { pagado: 0, notas_credito: 400, saldo: 600 });
    expect(row.notas_credito).toBe(400);
    expect(row.saldo).toBe(600);
    expect(row.flags.ncAplicada).toBe(true);
  });

  it("no deja saldos negativos aunque el servidor reporte sobrepago", () => {
    const row = mapJoinedRow(joined(), { pagado: 1200, notas_credito: 0, saldo: -200 });
    expect(row.saldo).toBe(0);
    expect(row.estatus).toBe("Pagada");
  });
});

describe("fetchFacturasCxP · consulta la vista de saldo (N1)", () => {
  beforeEach(() => {
    mock.resetResults();
    mock.tableCalls.length = 0;
  });

  it("pide el saldo al servidor en lugar de convertir en el navegador", async () => {
    mock.setTableResult("proveedor_facturas", { data: [joined()], error: null });
    mock.setTableResult("v_proveedor_facturas_saldo", {
      data: [
        { proveedor_factura_id: "pf-1", pagado: 0, notas_credito_aplicadas: 400, saldo: 600 },
      ],
      error: null,
    });

    const rows = await fetchFacturasCxP();
    expect(mock.tableCalls.some((c) => c.table === "v_proveedor_facturas_saldo")).toBe(true);
    expect(rows[0].saldo).toBe(600);
    expect(rows[0].notas_credito).toBe(400);
  });
});
