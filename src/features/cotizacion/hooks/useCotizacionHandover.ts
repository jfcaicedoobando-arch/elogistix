import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { fetchHandover } from "../services/handover";
import { puedeVerHandover } from "../domain/handoverVisibilidad";
import { cotizaciones } from "../queryKeys";
import type { CotizacionRow } from "../types";

/** Consulta sólo el handover existente de la empresa activa, sin crearlo. */
export function useCotizacionHandover(
  cotizacion: Pick<CotizacionRow, "id" | "organization_id" | "updated_at">,
) {
  const { effectiveRole } = useAuth();
  const { organizationId } = useOrganization();
  const visible = puedeVerHandover(effectiveRole, organizationId, cotizacion.organization_id);
  const query = useQuery({
    queryKey: cotizaciones.handover(cotizacion.id, organizationId, cotizacion.updated_at),
    enabled: visible,
    // También protege refetch manual cuando el contexto deja de ser visible.
    queryFn: () => visible && organizationId
      ? fetchHandover(cotizacion.id, organizationId)
      : Promise.resolve(null),
  });
  return { visible, query };
}
