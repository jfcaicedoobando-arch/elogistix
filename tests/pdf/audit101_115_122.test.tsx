import { describe, expect, it } from "vitest";
import { ReportePresupuestoDocument } from "@/pdf/documents/ReportePresupuestoDocument";
import { RentabilidadDocument } from "@/pdf/documents/RentabilidadDocument";
import type { ResumenVsReal } from "@/features/presupuesto/services";
import { inspectPdf } from "./inspectPdf";

const resumen: ResumenVsReal = {
  periodo: "2026-10", filas: [{ categoria_id: "administracion", categoria_nombre: "Categoría oculta", presupuesto_mxn: 100, real_mxn: 90, variacion_mxn: -10, cumplimiento_pct: 90 }],
  total_presupuesto_mxn: 100, total_real_mxn: 90, variacion_neta_mxn: -10,
  categorias_en_exceso: 0, top_exceso: [], gastos_sin_tc_count: 0, real_truncado: false,
  notas_proveedor_sin_base_count: 1,
};
describe("PDF real auditoría101/115/122", () => {
  it("preserva filtro vacío, alcance y aviso de base histórica incompleta", async () => {
    const pdf = await inspectPdf("audit115-122-presupuesto", <ReportePresupuestoDocument resumen={resumen} filas={[]} soloExcesos />);
    expect(pdf.pages).toBe(1);
    expect(pdf.text).toContain("Solo excesos");
    expect(pdf.text).toContain("Ninguna categoría excede");
    expect(pdf.text).toContain("Reporte provisional");
    expect(pdf.text).toContain("periodo completo");
    expect(pdf.text).not.toContain("Categoría oculta");
  });
  it("mantiene metodología de ETA y ventas facturadas junto a los resultados", async () => {
    const pdf = await inspectPdf("audit101-rentabilidad", <RentabilidadDocument fechaDesde="2026-10-01" fechaHasta="2026-10-31"
      kpis={{ total_venta_usd: 0, total_costo_usd: 100, total_profit_usd: -100, margen_promedio: 0 }}
      clientes={[{ cliente_nombre: "Cliente de prueba", total_embarques: 1, venta_usd: 0, costo_usd: 100, profit_usd: -100, margen: 0 }]} />);
    expect(pdf.pages).toBe(1);
    expect(pdf.text).toContain("ETA");
    expect(pdf.text).toContain("ventas facturadas");
    expect(pdf.text).toContain("costos operativos");
    expect(pdf.text).toContain("No calculable");
  });
});
