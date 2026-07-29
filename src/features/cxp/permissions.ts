/**
 * Q-04 — Segregación de funciones (SOD) para Compras/CxP.
 * Helper puro y testeable que centraliza qué roles pueden capturar y aprobar
 * facturas de proveedor. Reutiliza la matriz de `usePermissions` para no
 * duplicar la fuente de verdad de permisos.
 *
 * Espejo de reglas de BD:
 *  - Captura: admin, admin_org, super_admin, contador, auxiliar_contable.
 *  - Aprobación: admin, admin_org, super_admin, contador (tesorero y quien
 *    capturó la factura quedan excluidos; la RPC `aprobar_factura_proveedor`
 *    rechaza con `LC_SOD_VIOLATION` si además el usuario fue quien capturó).
 */
import type { AppRole } from "@/types/appRole";
import { APROBAR_FACTURA_PROVEEDOR, CAPTURAR_FACTURA_PROVEEDOR, hasRole } from "@/hooks/shared/permissionMatrix";

/** ¿El rol puede capturar (crear/editar) facturas de proveedor? */
export function puedeCapturarFacturaProveedor(role: AppRole | null | undefined): boolean {
  return hasRole(CAPTURAR_FACTURA_PROVEEDOR, role);
}

/** ¿El rol puede aprobar/rechazar facturas de proveedor? */
export function puedeAprobarFacturaProveedor(role: AppRole | null | undefined): boolean {
  return hasRole(APROBAR_FACTURA_PROVEEDOR, role);
}
