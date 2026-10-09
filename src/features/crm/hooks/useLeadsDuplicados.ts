/**
 * Clasificación de duplicados para importación CSV y alta manual de leads
 * (v13.630.0 — Ola A CRM).
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useOrgFilter } from "@/hooks/shared/useOrgFilter";
import { buscarLeadsDuplicados } from "@/features/crm/services/leadsDuplicados";
import {
  clasificarDuplicado,
  clasificarLote,
  type Coincidencia,
  type LeadClave,
} from "@/features/crm/domain/leadsDedupe";

const STALE = 30_000;

/**
 * Duplicados de un lote (CSV). Devuelve una coincidencia por fila.
 *
 * Falla cerrada: expone `isFetching` (revisión en curso) y `isError`; si la
 * consulta falla NO se puede clasificar todo como "nuevo" — el call-site debe
 * bloquear la importación y ofrecer reintentar.
 */
export function useDuplicadosLote(filas: ReadonlyArray<LeadClave>) {
  const { organizationId, orgListo } = useOrgFilter();
  const claves = filas.map((f) => ({
    empresa: f.empresa ?? "",
    email: f.email ?? "",
    telefono: f.telefono ?? "",
  }));
  const q = useQuery({
    queryKey: queryKeys.crm.leads.duplicados(claves, organizationId),
    queryFn: () => buscarLeadsDuplicados(claves),
    enabled: orgListo && claves.length > 0,
    staleTime: STALE,
  });
  const listo = orgListo && claves.length > 0 && q.isSuccess &&
    !q.isFetching && !q.isError && !q.isPlaceholderData && q.data !== undefined;
  const coincidencias: Coincidencia[] =
    listo ? clasificarLote(filas, q.data ?? []) : [];
  return {
    coincidencias,
    isLoading: q.isLoading,
    isFetching: q.isFetching,
    isError: q.isError,
    error: q.error,
    listo,
    refetch: q.refetch,
    existentes: listo ? q.data ?? [] : [],
  };
}

/**
 * Duplicado de un solo lead (alta manual).
 *
 * Falla cerrada: expone `isError`/`error`/`refetch` para que la UI avise
 * "no pudimos comprobar duplicados" en vez de fingir que no hay coincidencias.
 */
export function useDuplicadoLead(clave: LeadClave, habilitado = true) {
  const { organizationId, orgListo } = useOrgFilter();
  const tiene = Boolean(clave.empresa || clave.email || clave.telefono);
  const q = useQuery({
    queryKey: queryKeys.crm.leads.duplicado(clave.empresa, clave.email, clave.telefono, organizationId),
    queryFn: () => buscarLeadsDuplicados([clave]),
    enabled: orgListo && habilitado && tiene,
    staleTime: STALE,
  });
  const listo = orgListo && habilitado && tiene && q.isSuccess &&
    !q.isFetching && !q.isError && !q.isPlaceholderData && q.data !== undefined;
  const coincidencia = listo ? clasificarDuplicado(clave, q.data ?? []) : null;
  return {
    coincidencia,
    isLoading: q.isLoading,
    isError: tiene && q.isError,
    error: q.error,
    refetch: q.refetch,
  };
}
