import { useOrganization } from "@/lib/contexts/OrganizationContext";

/**
 * Organización efectiva para **escrituras** y validaciones.
 *
 * Fuente única de verdad (A2): para un usuario normal es su propia
 * organización; para el super admin de plataforma es el tenant elegido en el
 * `OrgSwitcher`. Nunca uses `useAuth().organizationId` en rutas de escritura:
 * ese valor es NULL para el super admin y genera registros huérfanos o errores
 * de "organización no resuelta" aunque tenga un tenant seleccionado.
 */
export function useOrgActiva(): { organizationId: string | null } {
  const { organizationId } = useOrganization();
  return { organizationId };
}
