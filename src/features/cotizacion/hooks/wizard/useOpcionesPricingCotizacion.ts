import { useQuery } from "@tanstack/react-query";
import { cotizaciones } from "@/features/cotizacion/queryKeys";
import { fetchOpcionesPricingCotizacion } from "@/features/cotizacion/services/opcionesPricingCotizacion";
import { usePricingScope } from "./usePricingScope";

export function useOpcionesPricingCotizacion({ oportunidadId, clienteId }: { oportunidadId?: string; clienteId?: string }) {
  const scope = usePricingScope();
  return useQuery({
    queryKey: cotizaciones.opcionesPricing(scope, oportunidadId, clienteId),
    queryFn: () => fetchOpcionesPricingCotizacion({ organizationId: scope.organizationId ?? "", oportunidadId, clienteId }),
    enabled: Boolean(scope.organizationId && scope.userId && (oportunidadId || clienteId)),
    staleTime: 0,
    refetchOnMount: "always",
  });
}
