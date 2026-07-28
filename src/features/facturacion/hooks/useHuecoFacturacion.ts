/**
 * Hook: datos + acciones de "Hueco de Facturación".
 * Aísla `useQuery` y la generación de CSV de la capa de UI.
 */
import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOrgFilter } from "@/hooks/shared";
import {
  fetchHuecoFacturacion,
  type FilaHueco,
  type HuecoFacturacionResult,
} from "@/features/facturacion/services";
import { exportToCsv } from "@/generators/exportCsv";
import { queryKeys } from "@/lib/query";
import {
  HUECO_CSV_HEADERS,
  buildHuecoCsvFilename,
  buildHuecoCsvRows,
} from "@/features/facturacion/domain/huecoCsv";

;

export function useHuecoFacturacion() {
  const { organizationId } = useOrgFilter();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.facturacion.hueco(organizationId),
    queryFn: () => fetchHuecoFacturacion({ organizationId: organizationId ?? null }),
    staleTime: 60_000,
  });

  const filas = useMemo(() => data?.filas ?? [], [data?.filas]);
  const totalEmbarques = data?.totalEmbarques ?? 0;
  const totalUsd = data?.totalUsd ?? 0;
  const totalMxn = data?.totalMxn ?? 0;

  const exportarCsv = useCallback(() => {
    if (filas.length === 0) return;
    exportToCsv(
      buildHuecoCsvFilename(),
      HUECO_CSV_HEADERS,
      buildHuecoCsvRows(filas),
    );
  }, [filas]);

  return {
    isLoading,
    isError,
    refetch,
    filas,
    totalEmbarques,
    totalUsd,
    totalMxn,
    exportarCsv,
  };
}

