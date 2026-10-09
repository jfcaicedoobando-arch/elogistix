import { useQuery } from "@tanstack/react-query";
import { cotizaciones } from "@/features/cotizacion/queryKeys";
import { fetchOpcionesPricingCotizacion } from "@/features/cotizacion/services/opcionesPricingCotizacion";

export function useOpcionesPricingCotizacion({ oportunidadId, clienteId }: { oportunidadId?: string; clienteId?: string }) {
  return useQuery({
    queryKey: cotizaciones.opcionesPricing(oportunidadId, clienteId),
    queryFn: () => fetchOpcionesPricingCotizacion({ oportunidadId, clienteId }),
    enabled: Boolean(oportunidadId || clienteId),
  });
}
