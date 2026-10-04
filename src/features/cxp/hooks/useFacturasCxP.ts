import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useDiaNegocio } from "@/hooks/shared/useDiaNegocio";
import {
  fetchFacturasCxP,
  calcularKPIsCxP,
  type FetchCxPFiltros,
} from "@/features/cxp/services";

export function useFacturasCxP(filtros: FetchCxPFiltros = {}) {
  const diaNegocio = useDiaNegocio();
  const key = useMemo(
    () => ({
      diaNegocio,
      search: filtros.search, proveedor_id: filtros.proveedor_id, moneda: filtros.moneda,
      estatus: filtros.estatus, origen: filtros.origen, aprobacion: filtros.aprobacion,
      categoria_presupuesto_id: filtros.categoria_presupuesto_id,
      fecha_desde: filtros.fecha_desde, fecha_hasta: filtros.fecha_hasta,
    }),
    [
      diaNegocio,
      filtros.search, filtros.proveedor_id, filtros.moneda, filtros.estatus,
      filtros.origen, filtros.aprobacion, filtros.categoria_presupuesto_id,
      filtros.fecha_desde, filtros.fecha_hasta,
    ],
  );
  const q = useQuery({
    queryKey: queryKeys.cxp.facturas(key),
    queryFn: () => fetchFacturasCxP(filtros, diaNegocio),
    staleTime: 30_000,
  });
  const kpis = useMemo(() => calcularKPIsCxP(q.data ?? [], diaNegocio), [q.data, diaNegocio]);
  return { ...q, kpis };
}

;
