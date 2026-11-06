import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { queryKeys } from "@/lib/query";
import { asignarCoordinadorCliente, fetchCoordinadorCliente } from "@/services/operaciones";

export function useClienteCoordinador(clienteId: string) {
  const { organizationId } = useOrganization();
  const query = useQuery({
    queryKey: queryKeys.clientes.coordinador(organizationId, clienteId),
    enabled: Boolean(organizationId),
    queryFn: () => (organizationId ? fetchCoordinadorCliente(clienteId, organizationId) : Promise.resolve(null)),
  });
  return {
    query,
    guardar: (coordinadorId: string | null) => asignarCoordinadorCliente(clienteId, coordinadorId),
  };
}
