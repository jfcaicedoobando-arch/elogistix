/**
 * Controller de la página de Auditoría operativa.
 * Encapsula filtros, derivaciones (por severidad/regla) y handlers de UI
 * para que la page sea solo composición.
 */
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatFechaHora } from "@/lib/formatters/dates";
import {
  AUDITORIA_QUERY_KEY,
  useAuditoria,
} from "@/features/auditoria/hooks/useAuditoria";
import {
  useAuditoriaRevisiones,
  revisionKey,
} from "@/features/auditoria/hooks/useAuditoriaRevisiones";
import type { SeveridadAuditoria } from "@/features/auditoria/types";
import {
  agruparPorRegla,
  contarPorSeveridad,
  filtrarHallazgos,
} from "@/features/auditoria/domain/core";

export function useAuditoriaPageController() {
  const { data, isLoading, isFetching } = useAuditoria();
  const { data: revisiones } = useAuditoriaRevisiones();
  const queryClient = useQueryClient();

  const [filtroSev, setFiltroSev] = useState<SeveridadAuditoria | "todas">("todas");
  const [filtroModo, setFiltroModo] = useState<string>("todos");
  const [mostrarRevisados, setMostrarRevisados] = useState(false);

  const hallazgos = useMemo(() => data?.hallazgos ?? [], [data?.hallazgos]);

  const hallazgosVisibles = useMemo(() => {
    if (mostrarRevisados || !revisiones || revisiones.size === 0) return hallazgos;
    return hallazgos.filter((h) => !revisiones.has(revisionKey(h)));
  }, [hallazgos, revisiones, mostrarRevisados]);

  const revisadosCount = useMemo(() => {
    if (!revisiones || revisiones.size === 0) return 0;
    return hallazgos.filter((h) => revisiones.has(revisionKey(h))).length;
  }, [hallazgos, revisiones]);

  const hallazgosFiltrados = useMemo(
    () =>
      filtrarHallazgos(hallazgosVisibles, {
        severidad: filtroSev,
        modo: filtroModo,
      }),
    [hallazgosVisibles, filtroSev, filtroModo],
  );

  const kpiSeveridad = useMemo(
    () => contarPorSeveridad(hallazgosVisibles),
    [hallazgosVisibles],
  );

  const porRegla = useMemo(
    () => agruparPorRegla(hallazgosFiltrados),
    [hallazgosFiltrados],
  );

  const modos = useMemo(() => {
    const set = new Set(hallazgos.map((h) => h.modo).filter(Boolean));
    return Array.from(set).sort();
  }, [hallazgos]);

  const handleRecalcular = () => {
    queryClient.invalidateQueries({ queryKey: AUDITORIA_QUERY_KEY });
  };

  const generadoEn = data?.generated_at
    ? formatFechaHora(data.generated_at)
    : null;

  return {
    data,
    isLoading,
    isFetching,
    hallazgos,
    hallazgosVisibles,
    hallazgosFiltrados,
    revisadosCount,
    kpiSeveridad,
    porRegla,
    modos,
    filtroSev,
    filtroModo,
    mostrarRevisados,
    generadoEn,
    setFiltroSev,
    setFiltroModo,
    setMostrarRevisados,
    handleRecalcular,
  };
}
