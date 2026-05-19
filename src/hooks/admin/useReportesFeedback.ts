import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listarReportes,
  obtenerReporte,
  actualizarEstadoReporte,
  eliminarReporte,
  listarComentarios,
  agregarComentario,
  type ListarReportesFiltros,
} from "@/services/feedback";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/shared/useToast";
import type { EstadoReporteFeedback } from "@/types/feedback";

export function useReportesFeedback(filtros: ListarReportesFiltros) {
  return useQuery({
    queryKey: ["admin-reportes-feedback", filtros],
    queryFn: () => listarReportes(filtros),
    placeholderData: (prev) => prev,
  });
}

export function useReporteFeedbackDetalle(id: string | undefined) {
  return useQuery({
    queryKey: ["admin-reporte-feedback", id],
    queryFn: () => obtenerReporte(id!),
    enabled: !!id,
  });
}

export function useReporteFeedbackComentarios(reporteId: string | undefined) {
  return useQuery({
    queryKey: ["admin-reporte-feedback-comentarios", reporteId],
    queryFn: () => listarComentarios(reporteId!),
    enabled: !!reporteId,
  });
}

export function useReporteFeedbackMutations(reporteId: string | undefined) {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const esAdmin = role === "super_admin";

  const cambiarEstado = useMutation({
    mutationFn: async (estado: EstadoReporteFeedback) => {
      if (!reporteId) throw new Error("Sin reporte");
      await actualizarEstadoReporte(reporteId, estado);
    },
    onSuccess: () => {
      toast({ title: "Estado actualizado" });
      qc.invalidateQueries({ queryKey: ["admin-reporte-feedback", reporteId] });
      qc.invalidateQueries({ queryKey: ["admin-reportes-feedback"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const comentar = useMutation({
    mutationFn: async (contenido: string) => {
      if (!reporteId || !user) throw new Error("Datos faltantes");
      await agregarComentario({
        reporteId,
        autorId: user.id,
        autorEmail: user.email ?? "",
        autorEsAdmin: esAdmin,
        contenido,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reporte-feedback-comentarios", reporteId] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const eliminar = useMutation({
    mutationFn: async () => {
      if (!reporteId) throw new Error("Sin reporte");
      await eliminarReporte(reporteId);
    },
    onSuccess: () => {
      toast({ title: "Reporte eliminado" });
      qc.invalidateQueries({ queryKey: ["admin-reportes-feedback"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return { cambiarEstado, comentar, eliminar };
}
