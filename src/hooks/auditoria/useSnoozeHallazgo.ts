/**
 * Mutation para silenciar un hallazgo hasta una fecha objetivo, con motivo
 * obligatorio. El hallazgo sigue siendo "pendiente" en BD pero queda oculto
 * de la tabla por defecto hasta `snoozed_until`.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  clearSnoozeRevision,
  snoozeRevision,
} from "@/services/auditoria";
import { insertBitacora } from "@/services/bitacora";
import { hallazgoHash } from "@/hooks/auditoria/useAuditoriaRevisiones";
import type { HallazgoAuditoria } from "@/types/auditoria";

export function useSnoozeHallazgo() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      hallazgo: HallazgoAuditoria;
      snoozedUntil: string; // YYYY-MM-DD
      motivo: string;
    }) => {
      if (!user) throw new Error("Sesión no válida");
      const { hallazgo, snoozedUntil, motivo } = params;
      const detalleHash = hallazgoHash(hallazgo);
      const data = await snoozeRevision({
        embarque_id: hallazgo.embarque_id,
        regla: hallazgo.regla,
        detalle_hash: detalleHash,
        detalle: hallazgo.detalle,
        snoozed_until: snoozedUntil,
        snooze_motivo: motivo,
      });

      try {
        await insertBitacora({
          usuarioId: user.id,
          usuarioEmail: user.email ?? "",
          accion: "snooze_hallazgo",
          modulo: "auditoria",
          entidadId: hallazgo.embarque_id,
          entidadNombre: `Hallazgo ${hallazgo.regla} — Embarque ${hallazgo.expediente}`,
          detalles: {
            regla: hallazgo.regla,
            severidad: hallazgo.severidad,
            snoozed_until: snoozedUntil,
            motivo,
          },
        });
      } catch (e) {
        console.warn("No se pudo registrar en bitácora:", e);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auditoria", "revisiones"] });
      queryClient.invalidateQueries({ queryKey: ["auditoria", "embarques"] });
      toast.success("Hallazgo silenciado");
    },
    onError: (err: Error) => {
      console.error("[useSnoozeHallazgo] error:", err);
      toast.error("No se pudo silenciar el hallazgo", { description: err.message });
    },
  });
}

export function useQuitarSnooze() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clearSnoozeRevision,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auditoria", "revisiones"] });
      queryClient.invalidateQueries({ queryKey: ["auditoria", "embarques"] });
      toast.success("Snooze removido");
    },
    onError: (err: Error) => {
      toast.error("Error al quitar snooze", { description: err.message });
    },
  });
}
