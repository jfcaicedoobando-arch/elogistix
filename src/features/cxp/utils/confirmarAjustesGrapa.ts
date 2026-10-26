/**
 * Validación manual de notas de ajuste con grapa contable: antes de agregar
 * cualquier renglón de ajuste (siempre queda ligado a la factura), se muestra
 * el detalle exacto y el usuario decide si se agrega o no.
 */
import type { AjustePropuesto } from "@/features/cxp/services/crearAjustesFacturaProveedor";

import { formatCurrency } from "@/lib/formatters";

export function textoConfirmacionAjustes(ajustes: AjustePropuesto[], moneda: string): string {
  const lineas = ajustes.map(
    (a) => `• ${a.descripcion}: ${formatCurrency(a.facturado, moneda)} − ${formatCurrency(a.original, moneda)} = ${formatCurrency(a.monto, moneda)}`,
  );
  return [
    "El sistema quiere agregar al embarque estas notas de ajuste, ligadas a la factura (grapa contable):",
    "",
    ...lineas,
    "",
    "¿Agregar estas notas? (Cancelar = no se agregan; la factura se conserva)",
  ].join("\n");
}

export function confirmarAjustesGrapa(ajustes: AjustePropuesto[], moneda: string): boolean {
  if (ajustes.length === 0) return true;
  return window.confirm(textoConfirmacionAjustes(ajustes, moneda));
}
