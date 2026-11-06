import type { AppRole } from "@/types/appRole";
import { SALES, hasRole } from "@/lib/access/permissionMatrix";

/** Sólo lectura; la autorización de datos permanece en las policies existentes. */
export function puedeVerHandover(
  rol: AppRole | null,
  organizationId: string | null,
  cotizacionOrgId: string | null,
): boolean {
  return !!organizationId && organizationId === cotizacionOrgId && hasRole(SALES, rol);
}