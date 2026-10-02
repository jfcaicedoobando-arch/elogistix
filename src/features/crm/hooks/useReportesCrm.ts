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
import type { ReporteDato } from "@/features/crm/services/reportes/tiposReportes";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";

const KEY = ["crm", "reportes"] as const;

function useInvalidar() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}

function alFallar(accion: string) {
  return (e: unknown) =>
    notifyError(undefined, { title: `No se pudo ${accion}`, description: getErrorMessage(e), error: e, method: "CRM_REPORTES" });
}

export function useTablerosCrm() {
  return useQuery({ queryKey: [...KEY, "tableros"], queryFn: listTableros });
}

export function useReportesDeTablero(tableroId: string | null) {
  return useQuery({
    queryKey: [...KEY, "lista", tableroId],
    queryFn: () => listReportes(tableroId as string),
    enabled: tableroId !== null,
  });
}

export function useReporteDatos(reporteId: string) {
  return useQuery<ReporteDato[]>({
    queryKey: [...KEY, "datos", reporteId],
    queryFn: () => fetchReporteDatos(reporteId),
  });
}

export function useCrearTablero() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (nombre: string) => crearTablero(nombre),
    onSuccess: () => {
      notifySuccess(undefined, { title: "Tablero creado" });
      invalidar();
    },
    onError: alFallar("crear el tablero"),
  });
}

export function useRenombrarTablero() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, nombre }: { id: string; nombre: string }) => renombrarTablero(id, nombre),
    onSuccess: () => {
      notifySuccess(undefined, { title: "Tablero renombrado" });
      invalidar();
    },
    onError: alFallar("renombrar el tablero"),
  });
}

export function useEliminarTablero() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: string) => eliminarTablero(id),
    onSuccess: () => {
      notifySuccess(undefined, { title: "Tablero eliminado" });
      invalidar();
    },
    onError: alFallar("eliminar el tablero"),
  });
}

export function useGuardarReporte() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, tableroId, input }: { id?: string; tableroId: string; input: ReporteInput }) =>
      id ? actualizarReporte(id, input) : crearReporte(tableroId, input),
    onSuccess: () => {
      notifySuccess(undefined, { title: "Reporte guardado" });
      invalidar();
    },
    onError: alFallar("guardar el reporte"),
  });
}

export function useEliminarReporte() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: string) => eliminarReporte(id),
    onSuccess: () => {
      notifySuccess(undefined, { title: "Reporte eliminado" });
      invalidar();
    },
    onError: alFallar("eliminar el reporte"),
  });
}
