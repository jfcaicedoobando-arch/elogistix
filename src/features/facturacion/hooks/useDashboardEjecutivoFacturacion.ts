import { useQuery } from "@tanstack/react-query";
import { useOrgFilter } from "@/hooks/shared";
import { fetchDashboardEjecutivoFacturacion } from "@/features/facturas/services/dashboardEjecutivo";

export function useDashboardEjecutivoFacturacion() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: ["facturacion", "dashboard-ejecutivo", organizationId],
    queryFn: () => fetchDashboardEjecutivoFacturacion(organizationId ?? null),
    staleTime: 60_000,
  });
}
