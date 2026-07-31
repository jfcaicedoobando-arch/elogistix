/**
 * v13.89.0 — Hook que devuelve el resumen de pendientes administrativos
 * (CxC, CxP, documentos, venta no facturada) para un embarque.
 *
 * Solo tiene sentido en embarques con estado `Entregado`, `EIR` o
 * `Por liquidar` (v13.380.1). Los
 * consumidores deciden si renderizar el badge según el estado.
 */
import { useQuery } from "@tanstack/react-query";
import {
  fetchAdminPendientesResumen,
  type AdminPendientesResumen,
} from "@/features/embarques/services/cierre";
import { queryKeys } from "@/lib/query";

export function useAdminPendienteResumen(embarqueId: string | undefined, enabled = true) {
  return useQuery<AdminPendientesResumen>({
    queryKey: queryKeys.embarques.adminPendientes(embarqueId),
    queryFn: () => fetchAdminPendientesResumen(embarqueId as string),
    enabled: Boolean(embarqueId) && enabled,
    staleTime: 30_000,
  });
}
