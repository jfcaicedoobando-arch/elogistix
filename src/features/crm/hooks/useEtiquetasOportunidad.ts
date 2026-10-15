import { useQuery } from "@tanstack/react-query";
import { crm } from "@/features/crm/queryKeys";
import { fetchOportunidadesEmpresaEliminada } from "@/features/crm/services/empresaEliminadaCrm";
import { fetchOportunidadesSolicitudRespondida, LLAVE_SOLICITUD_RESPONDIDA } from "@/features/crm/services/solicitudRespondidaCrm";

// Cada conjunto se comparte entre todas las tarjetas y la ficha de oportunidad.
export function useOportunidadesEmpresaEliminada() {
  return useQuery({
    queryKey: crm.objetos.empresaEliminada,
    queryFn: fetchOportunidadesEmpresaEliminada,
    staleTime: 30_000,
  });
}

export function useOportunidadesSolicitudRespondida() {
  return useQuery({
    queryKey: LLAVE_SOLICITUD_RESPONDIDA,
    queryFn: fetchOportunidadesSolicitudRespondida,
    staleTime: 30_000,
  });
}
