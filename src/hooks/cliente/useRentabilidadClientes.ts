import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchReportesResumen } from "@/services/reportes";

interface FiltrosRentabilidad {
  fechaDesde?: string;
  fechaHasta?: string;
  modo?: string;
}

export interface RentabilidadCliente {
  cliente_id: string;
  cliente_nombre: string;
  total_embarques: number;
  venta_usd: number;
  costo_usd: number;
  profit_usd: number;
  margen: number;
}

/**
 * v8.173.0 (Ola B.4): consume el RPC `reportes_resumen` que devuelve filas +
 * KPIs agregados en una sola llamada. Antes la agregación se hacía
 * client-side a partir de `profit_por_cliente`.
 */
export function useRentabilidadClientes(filtros: FiltrosRentabilidad) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.reportes.rentabilidadClientes(filtros),
    queryFn: () => fetchReportesResumen(filtros),
  });

  const clientes: RentabilidadCliente[] = useMemo(
    () => data?.clientes ?? [],
    [data],
  );

  const kpis = useMemo(
    () => data?.kpis ?? { totalClientes: 0, revenue: 0, profit: 0, margenProm: 0 },
    [data],
  );

  return { clientes, kpis, isLoading };
}
