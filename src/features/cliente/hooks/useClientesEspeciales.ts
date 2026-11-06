import { useQuery } from "@tanstack/react-query";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";
import { fetchClientesEspeciales } from "../services/listado";
import { clientes } from "../queryKeys";

/** Catálogo de clientes especiales, aislado por la organización activa. */
export function useClientesEspeciales() {
  const { organizationId } = useOrgActiva();
  return useQuery({
    queryKey: clientes.especiales(organizationId),
    queryFn: () => fetchClientesEspeciales(organizationId ?? ""),
    enabled: !!organizationId,
  });
}
