import { describe, expect, it } from "vitest";
import { calcularResumenTesoreria, type CxpRow } from "@/features/tesoreria/domain/resumen";
import { ReporteTesoreriaDocument } from "@/pdf/documents/ReporteTesoreriaDocument";
import { inspectPdf } from "./inspectPdf";

const factura = (overrides: Partial<CxpRow> = {}): CxpRow => ({
  id: "vencida-1", folio_proveedor: "FP-1", proveedor_nombre: "Proveedor de prueba",
  moneda: "MXN", saldo: 100, fecha_vencimiento: "2026-09-01",
  estatus: "Vencida", dias_vencido: 35, ...overrides,
});
const resumen = (cxp: CxpRow[]) => calcularResumenTesoreria({
  cuentas: [], cobranza: [], cxp, hoy: new Date("2026-10-06T00:00:00"),
});

describe("PDF Tesorería — alcance de acreedores vencidos (extensión 81)", () => {
  it("presenta proveedores vencidos por moneda y el máximo de días de atraso, no vencimientos futuros", async () => {
    const datos = resumen([
      factura(),
      factura({ id: "vencida-2", saldo: 200, dias_vencido: 6 }),
      factura({ id: "vencida-usd", moneda: "USD", saldo: 50, dias_vencido: 12 }),
      factura({ id: "futura", proveedor_nombre: "Proveedor futuro", saldo: 999, estatus: "Por vencer", dias_vencido: -5, fecha_vencimiento: "2026-10-11" }),
    ]);
    expect(datos.top_acreedores).toEqual([
      { nombre: "Proveedor de prueba", moneda: "MXN", saldo: 300, dias: 35 },
      { nombre: "Proveedor de prueba", moneda: "USD", saldo: 50, dias: 12 },
    ]);
    const pdf = await inspectPdf("tesoreria-proveedores-vencidos", <ReporteTesoreriaDocument fechaCorte="2026-10-06" resumen={datos} />);
    expect(pdf.pages).toBe(1);
    expect(pdf.text).toContain("Top 5 proveedores con saldo vencido por moneda");
    expect(pdf.text).toContain("Días vencidos");
    expect(pdf.text).toContain("mayor atraso de las facturas agrupadas por nombre y moneda");
    expect(pdf.text).toContain("MXN 300.00 35");
    expect(pdf.text).toContain("USD 50.00 12");
    expect(pdf.text).not.toContain("Proveedor futuro");
    expect(pdf.text).not.toContain("vencimientos próximos");
  });

  it("explica el estado vacío como ausencia de proveedores con facturas vencidas", async () => {
    const pdf = await inspectPdf("tesoreria-sin-vencidos", <ReporteTesoreriaDocument fechaCorte="2026-10-06" resumen={resumen([])} />);
    expect(pdf.pages).toBe(1);
    expect(pdf.text).toContain("Sin proveedores con facturas vencidas");
    expect(pdf.text).not.toContain("vencimientos próximos");
  });
});
