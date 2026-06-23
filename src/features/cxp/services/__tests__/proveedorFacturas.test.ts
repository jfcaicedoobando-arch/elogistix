import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchFacturasCxP, calcularKPIsCxP, crearFacturaProveedor } from "../proveedorFacturas";

describe("proveedorFacturas service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
  });

  it("fetchFacturasCxP calcula saldo correctamente", async () => {
    mock.setTableResult("proveedor_facturas", { 
      data: [{ 
        id: "f1", total: 1000, 
        pagos_proveedor: [{ monto: 200, deleted_at: null }],
        proveedor_notas_credito: [{ monto: 100, estado: "Aplicada", deleted_at: null }]
      }], 
      error: null 
    });
    const res = await fetchFacturasCxP();
    expect(res[0].saldo).toBe(700);
  });

  it("calcularKPIsCxP suma montos por moneda", () => {
    const filas = [
      { saldo: 100, moneda: "MXN", estatus: "Vigente" },
      { saldo: 200, moneda: "USD", estatus: "Vencida" }
    ] as any;
    const kpis = calcularKPIsCxP(filas);
    expect(kpis.por_pagar_mxn).toBe(100);
    expect(kpis.por_pagar_usd).toBe(200);
    expect(kpis.facturas_vencidas).toBe(1);
  });

  it("crearFacturaProveedor inserta registro", async () => {
    mock.setTableResult("proveedor_facturas", { data: { id: "f1" }, error: null });
    const res = await crearFacturaProveedor({ folio_proveedor: "X" } as any);
    expect(res.id).toBe("f1");
  });

  it("fetchFacturasCxP expone archivo_xml_url y archivo_pdf_url en el shape FacturaCxP", async () => {
    mock.setTableResult("proveedor_facturas", {
      data: [{
        id: "f2", total: 100,
        archivo_xml_url: "org/cfdi/f2/factura.xml",
        archivo_pdf_url: null,
      }],
      error: null,
    });
    const res = await fetchFacturasCxP();
    expect(res[0].archivo_xml_url).toBe("org/cfdi/f2/factura.xml");
    expect(res[0].archivo_pdf_url).toBeNull();
  });
});
