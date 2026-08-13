/**
 * Permisos del asistente "Refacturar a otro receptor".
 *
 * Espejo exacto del guard de la base `public._assert_refacturador`
 * (v13.588.0): administradores del tenant y TODOS los roles contables
 * (`contador`, `auxiliar_contable`). Cualquier otro rol sólo consulta.
 */
import type { AppRole } from "@/types/appRole";
import { OPERAR_REFACTURACION, hasRole } from "@/lib/access/permissionMatrix";

export function puedeOperarRefacturacion(role: AppRole | null | undefined): boolean {
  return hasRole(OPERAR_REFACTURACION, role);
}

/** Texto para el usuario cuando su rol no puede operar el caso. */
export function motivoBloqueoRefacturacion(role: AppRole | null | undefined): string | null {
  if (puedeOperarRefacturacion(role)) return null;
  return "Tu rol sólo puede consultar: para operar la refacturación se requiere un rol contable (contador o auxiliar contable) o de administración.";
}
