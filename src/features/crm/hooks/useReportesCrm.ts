import { crmReportesKeys } from "@/features/crm/queryKeys.performance";
/**
 * Hooks de los reportes dinámicos del CRM (Fase 7).
 * Llave base: ['crm', 'reportes'].
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  actualizarReporte,
  crearReporte,
  crearTablero,
  eliminarReporte,
  eliminarTablero,
  fetchReporteDatos,
  listReportes,
  listTableros,
  renombrarTablero,
  type ReporteInput,
} from "@/features/crm/services/reportes/reportesCrm";
import type { CrmReporteRow, CrmTableroRow, ReporteDato } from "@/features/crm/services/reportes/tiposReportes";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";

function useInvalidarTableros() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: crmReportesKeys.tableros, exact: true });
}

function alFallar(accion: string) {
  return (e: unknown) =>
    notifyError(undefined, { title: `No se pudo ${accion}`, description: getErrorMessage(e), error: e, method: "CRM_REPORTES" });
}

export function useTablerosCrm() {
  return useQuery({ queryKey: crmReportesKeys.tableros, queryFn: listTableros });
}

export function useReportesDeTablero(tableroId: string | null) {
  return useQuery({
    queryKey: crmReportesKeys.lista(tableroId),
    queryFn: () => listReportes(tableroId as string),
    enabled: tableroId !== null,
  });
}

export function useReporteDatos(reporteId: string) {
  return useQuery<ReporteDato[]>({
    queryKey: crmReportesKeys.datos(reporteId),
    queryFn: () => fetchReporteDatos(reporteId),
  });
}

export function useCrearTablero() {
  const invalidar = useInvalidarTableros();
  return useMutation({
    mutationFn: (nombre: string) => crearTablero(nombre),
    onSuccess: () => {
      notifySuccess(undefined, { title: "Tablero creado" });
      void invalidar();
    },
    onError: alFallar("crear el tablero"),
  });
}

export function useRenombrarTablero() {
  const invalidar = useInvalidarTableros();
  return useMutation({
    mutationFn: ({ id, nombre }: { id: string; nombre: string }) => renombrarTablero(id, nombre),
    onSuccess: () => {
      notifySuccess(undefined, { title: "Tablero renombrado" });
      void invalidar();
    },
    onError: alFallar("renombrar el tablero"),
  });
}

export function useEliminarTablero() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eliminarTablero(id),
    onSuccess: async (_data, id) => {
      notifySuccess(undefined, { title: "Tablero eliminado" });
      const lista = crmReportesKeys.lista(id);
      const reportes = qc.getQueryData<CrmReporteRow[]>(lista) ?? [];
      // No recalcular datos de reportes borrados; cancelar también lecturas en vuelo.
      await qc.cancelQueries({ queryKey: lista, exact: true });
      for (const reporte of reportes) {
        await qc.cancelQueries({ queryKey: crmReportesKeys.datos(reporte.id), exact: true });
        qc.removeQueries({ queryKey: crmReportesKeys.datos(reporte.id), exact: true });
      }
      qc.removeQueries({ queryKey: lista, exact: true });
      await qc.cancelQueries({ queryKey: crmReportesKeys.tableros, exact: true });
      qc.setQueryData<CrmTableroRow[]>(crmReportesKeys.tableros, (prev) => prev?.filter((t) => t.id !== id));
      void qc.invalidateQueries({ queryKey: crmReportesKeys.tableros, exact: true });
    },
    onError: alFallar("eliminar el tablero"),
  });
}

export function useGuardarReporte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tableroId, input }: { id?: string; tableroId: string; input: ReporteInput }) =>
      id ? actualizarReporte(id, input) : crearReporte(tableroId, input),
    onSuccess: (_data, { id, tableroId }) => {
      notifySuccess(undefined, { title: "Reporte guardado" });
      void Promise.all([
        qc.invalidateQueries({ queryKey: crmReportesKeys.lista(tableroId), exact: true }),
        ...(id ? [qc.invalidateQueries({ queryKey: crmReportesKeys.datos(id), exact: true })] : []),
      ]);
    },
    onError: alFallar("guardar el reporte"),
  });
}

export function useEliminarReporte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eliminarReporte(id),
    onSuccess: async (_data, id) => {
      notifySuccess(undefined, { title: "Reporte eliminado" });
      await qc.cancelQueries({ queryKey: crmReportesKeys.datos(id), exact: true });
      qc.removeQueries({ queryKey: crmReportesKeys.datos(id), exact: true });
      const listas = qc.getQueriesData<CrmReporteRow[]>({ queryKey: crmReportesKeys.listas })
        .filter(([, reportes]) => reportes?.some((r) => r.id === id));
      for (const [queryKey] of listas) {
        qc.setQueryData<CrmReporteRow[]>(queryKey, (prev) => prev?.filter((r) => r.id !== id));
      }
      // El ID del tablero puede no estar en caché; en ese caso sólo refrescar metadatos.
      void Promise.all(listas.length > 0
        ? listas.map(([queryKey]) => qc.invalidateQueries({ queryKey, exact: true }))
        : [qc.invalidateQueries({ queryKey: crmReportesKeys.listas })]);
    },
    onError: alFallar("eliminar el reporte"),
  });
}
