import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchFacturasCxP,
  calcularKPIsCxP,
  type EstatusCxP,
  type FetchCxPFiltros,
} from "@/features/cxp/services";

export function useFacturasCxP(filtros: FetchCxPFiltros = {}) {
  const key = useMemo(
    () => ({
      search: filtros.search, proveedor_id: filtros.proveedor_id, moneda: filtros.moneda,
      estatus: filtros.estatus, origen: filtros.origen, aprobacion: filtros.aprobacion,
      categoria_presupuesto_id: filtros.categoria_presupuesto_id,
      fecha_desde: filtros.fecha_desde, fecha_hasta: filtros.fecha_hasta,
    }),
    [
      filtros.search, filtros.proveedor_id, filtros.moneda, filtros.estatus,
      filtros.origen, filtros.aprobacion, filtros.categoria_presupuesto_id,
      filtros.fecha_desde, filtros.fecha_hasta,
    ],
  );
  const q = useQuery({
    queryKey: queryKeys.cxp.facturas(key),
    queryFn: () => fetchFacturasCxP(filtros),
    staleTime: 30_000,
  });
  const kpis = useMemo(() => calcularKPIsCxP(q.data ?? []), [q.data]);
  return { ...q, kpis };
}

;
