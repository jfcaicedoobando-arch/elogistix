/**
 * Q-04 — Segregación de funciones (SOD) para Compras/CxP.
 * Helper puro y testeable que centraliza qué roles pueden capturar y aprobar
 * facturas de proveedor. Reutiliza la matriz de `usePermissions` para no
 * duplicar la fuente de verdad de permisos.
 *
 * Espejo de reglas de BD:
 *  - Captura: admin, admin_org, super_admin, contador, auxiliar_contable.
 *  - Aprobación: admin, admin_org, super_admin, contador (tesorero y quien
 *    no tenga permiso de aprobación quedan excluidos). Administradores y
 *    contador pueden aprobar sus propias capturas dentro de su acceso vigente.
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

/** Roles que sí pueden aprobar una factura que ellos mismos capturaron. */
const ROLES_AUTOAPROBACION_FACTURA_PROVEEDOR: readonly AppRole[] = ["admin", "admin_org", "super_admin", "contador"];

/** Motivo mostrado al usuario cuando la SoD le impide aprobar su propia captura. */
export const SOD_MOTIVO_CAPTURA_PROPIA =
  "Tú capturaste esta factura; debe aprobarla otra persona (segregación de funciones).";

interface SodArgs {
  role: AppRole | null | undefined;
  userId: string | null | undefined;
  createdBy: string | null | undefined;
}

/**
 * Espejo en el cliente de la regla SoD de `aprobar_factura_proveedor`:
 * quien capturó la factura no la aprueba, salvo administradores y contador.
 * Devuelve `null` si puede aprobar, o el motivo del bloqueo.
 */
export function motivoBloqueoAprobacion({ role, userId, createdBy }: SodArgs): string | null {
  if (!puedeAprobarFacturaProveedor(role)) {
    return "Tu rol no puede aprobar ni rechazar facturas de proveedor.";
  }
  if (role && ROLES_AUTOAPROBACION_FACTURA_PROVEEDOR.includes(role)) return null;
  if (userId && createdBy && userId === createdBy) return SOD_MOTIVO_CAPTURA_PROPIA;
  return null;
}

/** ¿Este usuario puede aprobar ESTA factura (rol + segregación de funciones)? */
export function puedeAprobarEstaFactura(args: SodArgs): boolean {
  return motivoBloqueoAprobacion(args) === null;
}
