/**
 * Filtros server-side de `/crm/oportunidades` + exportación CSV completa.
 * Extraído de `Oportunidades.tsx` (Power of 10 — límite de líneas por archivo).
 */
import { useMemo, useState } from "react";
import { exportarOportunidadesCsv } from "@/features/crm/services/crmCsvExport";
import { listOportunidadesTodas } from "@/features/crm/services/oportunidades";
import { notifyError } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import type { OportunidadesFiltros } from "@/features/crm/components/oportunidadesFiltersTypes";

export function useOportunidadesFiltrosServidor(debounced: string, filtros: OportunidadesFiltros) {
  const montoMin = filtros.montoMin ? Number(filtros.montoMin) : null;
  // v13.823.49 — todos los filtros (etapa, vendedor, rango de cierre y monto
  // mínimo) viajan al servidor: antes se aplicaban en memoria sobre las
  // primeras 500 filas y el listado omitía coincidencias posteriores.
  const filtrosServidor = useMemo(
    () => ({
      search: debounced,
      etapaId: filtros.etapaId,
      vendedorId: filtros.vendedorId,
      cierreDesde: filtros.cierreDesde,
      cierreHasta: filtros.cierreHasta,
      montoMin: montoMin !== null && Number.isFinite(montoMin) ? montoMin : null,
    }),
    [debounced, filtros.etapaId, filtros.vendedorId, filtros.cierreDesde, filtros.cierreHasta, montoMin],
  );
  return filtrosServidor;
}

export function useExportarOportunidades(filtrosServidor: ReturnType<typeof useOportunidadesFiltrosServidor>) {
  const [exportando, setExportando] = useState(false);
  const exportarTodo = async () => {
    setExportando(true);
    try {
      const todas = await listOportunidadesTodas(filtrosServidor);
      exportarOportunidadesCsv(todas);
    } catch (e) {
      notifyError(undefined, {
        title: "No se pudo exportar",
        description: getErrorMessage(e),
        error: e,
        method: "EXPORT_OPORTUNIDADES",
      });
    } finally {
      setExportando(false);
    }
  };
  return { exportando, exportarTodo };
}
