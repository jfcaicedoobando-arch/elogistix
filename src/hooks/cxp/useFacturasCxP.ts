import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchFacturasCxP,
  calcularKPIsCxP,
  type EstatusCxP,
  type FetchCxPFiltros,
} from "@/services/cxp";

export function useFacturasCxP(filtros: FetchCxPFiltros = {}) {
  const key = useMemo(() => filtros, [
    filtros.search, filtros.proveedor_id, filtros.moneda, filtros.estatus,
    filtros.origen, filtros.fecha_desde, filtros.fecha_hasta,
  ]);
  const q = useQuery({
    queryKey: queryKeys.cxp.facturas(key),
    queryFn: () => fetchFacturasCxP(filtros),
    staleTime: 30_000,
  });
  const kpis = useMemo(() => calcularKPIsCxP(q.data ?? []), [q.data]);
  return { ...q, kpis };
}

export type { EstatusCxP };
