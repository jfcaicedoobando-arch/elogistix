import { useQuery } from "@tanstack/react-query";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";
import { useMutationWithFeedback } from "@/hooks/shared";
import { crearBroker, listarBrokers, type AltaBrokerInput } from "@/features/admin/services/brokers";

const KEY = ["admin", "brokers"] as const;

export function useBrokers() {
  const { organizationId } = useOrgActiva();
  return useQuery({
    queryKey: [...KEY, organizationId],
    queryFn: () => listarBrokers(organizationId as string),
    enabled: !!organizationId,
  });
}

export function useCrearBroker() {
  const { organizationId } = useOrgActiva();
  return useMutationWithFeedback({
    mutationFn: (p: Omit<AltaBrokerInput, "organization_id">) =>
      crearBroker({ ...p, organization_id: organizationId as string }),
    invalidate: [...KEY],
    successTitle: "Broker dado de alta",
    successDescription: "Le enviamos un correo para que cree su contraseña. Puede tardar unos minutos.",
    errorTitle: "No se pudo crear el broker",
    errorMethod: "CREATE_BROKER",
  });
}
