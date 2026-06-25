import { useQuery } from "@tanstack/react-query";
import { useOrgFilter } from "@/hooks/shared";
import { useExchangeRates } from "@/features/catalogos/hooks/useExchangeRates";
import { fetchDashboardEjecutivoFacturacion } from "@/features/facturacion/services/dashboardEjecutivo";

export function useDashboardEjecutivoFacturacion() {
  const { organizationId } = useOrgFilter();
  const { data: tc } = useExchangeRates();
  const fallback = tc?.usdMxn ?? null;
  return useQuery({
    queryKey: ["facturacion", "dashboard-ejecutivo", organizationId, fallback],
    queryFn: () => fetchDashboardEjecutivoFacturacion(organizationId ?? null, fallback),
    staleTime: 60_000,
  });
}
