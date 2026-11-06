import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { fetchHandoverProveedores } from "../services/handover";
import { puedeVerHandover } from "../domain/handoverVisibilidad";
import { cotizaciones } from "../queryKeys";
import type { CotizacionRow } from "../types";

/** Los agentes son de la empresa activa; las navieras son catálogo global. */
export function useHandoverProveedores(
  cotizacion: Pick<CotizacionRow, "organization_id" | "agente_id" | "naviera_id">,
  tieneHandover: boolean,
) {
  const { effectiveRole } = useAuth();
  const { organizationId } = useOrganization();
  const enabled = tieneHandover && puedeVerHandover(effectiveRole, organizationId, cotizacion.organization_id);
  return useQuery({
    queryKey: cotizaciones.handoverProveedores(organizationId, cotizacion.agente_id ?? null, cotizacion.naviera_id ?? null),
    enabled,
    queryFn: () => enabled && organizationId
      ? fetchHandoverProveedores(organizationId, cotizacion.agente_id, cotizacion.naviera_id)
      : Promise.resolve(null),
  });
}
