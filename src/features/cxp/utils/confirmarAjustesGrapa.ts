/**
 * Validación manual de notas de ajuste con grapa contable: antes de agregar
 * cualquier renglón de ajuste (siempre queda ligado a la factura), se muestra
 * el detalle exacto y el usuario decide si se agrega o no.
 */
import type { AjustePropuesto } from "@/features/cxp/services/crearAjustesFacturaProveedor";

const fmt = (n: number, moneda: string) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: moneda }).format(n);

export function textoConfirmacionAjustes(ajustes: AjustePropuesto[], moneda: string): string {
  const lineas = ajustes.map(
    (a) => `• ${a.descripcion}: ${fmt(a.facturado, moneda)} − ${fmt(a.original, moneda)} = ${fmt(a.monto, moneda)}`,
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
