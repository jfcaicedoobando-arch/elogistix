import { useQueryClient, type InvalidateQueryFilters } from "@tanstack/react-query";
import { crmPricingKeys } from "@/features/crm/queryKeys.performance";
import { LLAVE_SOLICITUD_RESPONDIDA } from "@/features/crm/components/objetos/EtiquetaSolicitudRespondida";

export function useInvalidarSolicitud() {
  const qc = useQueryClient();
  return (id: string, oportunidadId: string | null | undefined, vigente = () => true) => {
    const filters: InvalidateQueryFilters[] = [
      { queryKey: crmPricingKeys.solicitud(id), exact: true },
      // Un cambio de estado mueve filas entre filtros/páginas de la bandeja.
      { queryKey: crmPricingKeys.bandejas },
      { queryKey: LLAVE_SOLICITUD_RESPONDIDA },
      ...(oportunidadId ? [{ queryKey: crmPricingKeys.oportunidad(oportunidadId), exact: true }] : []),
    ];
    return Promise.all(filters.map((options) => vigente() ? qc.invalidateQueries(options) : undefined));
  };
}
