/**
 * Clasificación de duplicados para importación CSV y alta manual de leads
 * (v13.630.0 — Ola A CRM).
 */
import { useQuery } from "@tanstack/react-query";
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
  const claves = filas.map((f) => ({
    empresa: f.empresa ?? "",
    email: f.email ?? "",
    telefono: f.telefono ?? "",
  }));
  const q = useQuery({
    queryKey: ["crm", "leads", "duplicados", claves],
    queryFn: () => buscarLeadsDuplicados(claves),
    enabled: claves.length > 0,
    staleTime: STALE,
  });
  const listo = claves.length > 0 && q.data !== undefined;
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
    existentes: q.data ?? [],
  };
}

/** Duplicado de un solo lead (alta manual). */
export function useDuplicadoLead(clave: LeadClave, habilitado = true) {
  const tiene = Boolean(clave.empresa || clave.email || clave.telefono);
  const q = useQuery({
    queryKey: ["crm", "leads", "duplicado", clave.empresa, clave.email, clave.telefono],
    queryFn: () => buscarLeadsDuplicados([clave]),
    enabled: habilitado && tiene,
    staleTime: STALE,
  });
  const coincidencia = tiene ? clasificarDuplicado(clave, q.data ?? []) : null;
  return { coincidencia, isLoading: q.isLoading };
}
