/**
 * KPIs de conteo por organización (miembros, embarques, clientes, cotizaciones).
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  countOrgClientes,
  countOrgCotizaciones,
  countOrgEmbarques,
  countOrgMembers,
} from "@/services/admin";

export function useAdminOrgKpis(id: string | undefined) {
  const { data: memberCount = 0 } = useQuery({
    queryKey: queryKeys.admin.orgCountMembers(id!),
    queryFn: () => countOrgMembers(id!),
    enabled: !!id,
  });
  const { data: embarqueCount = 0 } = useQuery({
    queryKey: queryKeys.admin.orgCountEmbarques(id!),
    queryFn: () => countOrgEmbarques(id!),
    enabled: !!id,
  });
  const { data: clienteCount = 0 } = useQuery({
    queryKey: queryKeys.admin.orgCountClientes(id!),
    queryFn: () => countOrgClientes(id!),
    enabled: !!id,
  });
  const { data: cotizacionCount = 0 } = useQuery({
    queryKey: queryKeys.admin.orgCountCotizaciones(id!),
    queryFn: () => countOrgCotizaciones(id!),
    enabled: !!id,
  });

  return { memberCount, embarqueCount, clienteCount, cotizacionCount };
}
