/** Los puentes generados por la RPC de ajustes no son asignaciones de factura. */
import type { CCRow, PFCRow } from "./reconciliacionCostos.tipos";

export const esAjustePresupuestario = (costo: CCRow) => costo.origen === "ajuste_factura_proveedor";

export function esFacturaVigente(factura: PFCRow["proveedor_facturas"]): boolean {
  return Boolean(factura && !factura.deleted_at && (factura.estado ?? "").toLowerCase() !== "cancelada" && factura.estado_aprobacion !== "rechazada");
}

/**
 * Valida el contrato del writer: ajuste más puente para la misma factura que
 * tiene una asignación ordinaria en ese embarque. No infiere un costo padre
 * por descripción ni distribuye el delta entre renglones.
 */
export function conceptosConAjustesVerificables(conceptos: CCRow[], vinculos: PFCRow[]): CCRow[] {
  const porId = new Map(conceptos.map((costo) => [costo.id, costo]));
  const asignaciones = new Set<string>();
  const porCosto = new Map<string, PFCRow[]>();
  for (const vinculo of vinculos) {
    if (!vinculo.concepto_costo_id) continue;
    const costo = porId.get(vinculo.concepto_costo_id);
    const rows = porCosto.get(vinculo.concepto_costo_id) ?? [];
    rows.push(vinculo);
    porCosto.set(vinculo.concepto_costo_id, rows);
    if (costo && !esAjustePresupuestario(costo) && esFacturaVigente(vinculo.proveedor_facturas)) {
      asignaciones.add(`${vinculo.proveedor_facturas!.id}|${costo.embarque_id ?? ""}`);
    }
  }
  return conceptos.filter((costo) => {
    if (!esAjustePresupuestario(costo)) return true;
    const rows = porCosto.get(costo.id) ?? [];
    // Una factura cancelada/eliminada/rechazada revierte sus ajustes. Si queda
    // un costo activo legacy, no arrastra ese delta a la conciliación vigente.
    if (rows.length > 0 && rows.every((row) => row.proveedor_facturas && !esFacturaVigente(row.proveedor_facturas))) return false;
    const verificable = rows.some((row) => esFacturaVigente(row.proveedor_facturas) &&
      asignaciones.has(`${row.proveedor_facturas!.id}|${costo.embarque_id ?? ""}`));
    if (!verificable) {
      throw new Error("No se puede conciliar un ajuste presupuestario sin una factura y una asignación real visibles. Revisa sus vínculos.");
    }
    return true;
  });
}
