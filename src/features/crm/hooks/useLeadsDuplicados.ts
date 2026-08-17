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

/** Duplicados de un lote (CSV). Devuelve una coincidencia por fila. */
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
  const coincidencias: Coincidencia[] =
    claves.length === 0 ? [] : clasificarLote(filas, q.data ?? []);
  return { coincidencias, isLoading: q.isLoading, existentes: q.data ?? [] };
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
