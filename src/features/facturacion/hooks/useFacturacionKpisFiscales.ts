/**
 * Hook de KPIs fiscales pendientes (Fase 6 del plan FacturApi).
 *
 * - Proformas convertibles: estado=Aprobada y sin factura_id.
 * - Facturas sin timbrar:   estado=Borrador y facturapi_id IS NULL.
 * - REPs pendientes:        pagos_factura con estado_rep IN ('Pendiente','Error').
 */
import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import {
  fetchFacturacionKpisFiscales,
  type FacturacionKpisFiscales,
} from "@/features/facturacion/services/kpisFiscales";

export type { FacturacionKpisFiscales };

export function useFacturacionKpisFiscales() {
  const { organization } = useOrganization();
  const orgId = organization?.id ?? null;
  return useQuery({
    queryKey: ["facturacion-kpis-fiscales", orgId],
    queryFn: () => fetchFacturacionKpisFiscales(orgId!),
    enabled: !!orgId,
    staleTime: 60_000,
  });
}
