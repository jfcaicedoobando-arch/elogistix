/**
 * Mapeo fila→formulario para la edición de facturas de proveedor.
 * Extraído de `useEditarFacturaProveedorForm.ts` para respetar el límite de
 * 200 líneas por archivo (Power of 10). Función pura.
 */
import type { FacturaParaEdicion } from "@/features/cxp/services";
import type { FacturaFormValues } from "@/features/cxp/types";
import { addDays } from "@/features/cxp/hooks/useNuevaFacturaProveedorForm.helpers";

function numOrEmpty(v: unknown): string {
  const n = Number(v ?? 0) || 0;
  return n ? String(n) : "";
}

export function fromRow(r: FacturaParaEdicion): FacturaFormValues {
  const dias = Number(r.dias_credito) || 0;
  const tc = Number(r.tipo_cambio_usd) || 0;
  return {
    provId: r.proveedor_id,
    provNombre: r.proveedor_nombre,
    folio: r.folio_proveedor,
    emision: r.fecha_emision,
    diasCredito: dias,
    vencimiento: r.fecha_vencimiento ?? addDays(r.fecha_emision, dias),
    moneda: r.moneda,
    tc: r.moneda === "MXN" ? "" : (tc ? String(tc) : ""),
    subtotal: numOrEmpty(r.subtotal),
    iva: numOrEmpty(r.iva),
    ieps: numOrEmpty(r.ieps),
    retenciones: numOrEmpty(r.retenciones),
    categoriaId: r.categoria_presupuesto_id ?? "",
    notas: r.notas ?? "",
  };
}
