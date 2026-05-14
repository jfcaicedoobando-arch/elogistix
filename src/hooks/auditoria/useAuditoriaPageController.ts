/**
 * Controller de la página de Auditoría operativa.
 * Encapsula filtros, derivaciones (por severidad/regla) y handlers de UI
 * para que la page sea solo composición.
 */
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AUDITORIA_QUERY_KEY,
  useAuditoria,
} from "@/hooks/auditoria/useAuditoria";
import {
  useAuditoriaRevisiones,
  revisionKey,
} from "@/hooks/auditoria/useAuditoriaRevisiones";
import type { SeveridadAuditoria } from "@/types/auditoria";
import {
  agruparPorRegla,
  contarPorSeveridad,
  filtrarHallazgos,
} from "@/lib/domain/auditoria";

export function useAuditoriaPageController() {
  const { data, isLoading, isFetching } = useAuditoria();
  const { data: revisiones } = useAuditoriaRevisiones();
  const queryClient = useQueryClient();

  const [filtroSev, setFiltroSev] = useState<SeveridadAuditoria | "todas">("todas");
  const [filtroModo, setFiltroModo] = useState<string>("todos");
  const [mostrarRevisados, setMostrarRevisados] = useState(false);

  const hallazgos = data?.hallazgos ?? [];

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
    ? new Date(data.generated_at).toLocaleString("es-MX", {
        dateStyle: "short",
        timeStyle: "short",
      })
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
