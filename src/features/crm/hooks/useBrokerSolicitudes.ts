import { useQuery } from "@tanstack/react-query";
import { useMutationWithFeedback } from "@/hooks/shared";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";
import { listarSolicitudesBroker, resolverSolicitudBroker } from "../services/brokerSolicitudes";

const KEY = ["crm", "broker-solicitudes"] as const;

export function useBrokerSolicitudes() {
  const { organizationId } = useOrgActiva();
  return useQuery({ queryKey: [...KEY, organizationId], queryFn: listarSolicitudesBroker, enabled: !!organizationId });
}

export const useResolverSolicitudBroker = () =>
  useMutationWithFeedback({
    mutationFn: (v: { id: string; autorizar: boolean; motivo?: string }) =>
      resolverSolicitudBroker(v.id, v.autorizar, v.motivo),
    invalidate: [...KEY],
    successTitle: "Solicitud resuelta",
    successDescription: "Avisamos al broker.",
    errorTitle: "No se pudo resolver la solicitud",
  });
