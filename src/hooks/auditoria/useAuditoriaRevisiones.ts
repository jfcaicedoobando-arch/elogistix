/**
 * Hook de revisiones de auditoría: marca/desmarca hallazgos como revisados.
 * Toda la I/O contra Supabase se delega a `services/auditoria` y `services/bitacora`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  asignarResponsableHallazgo,
  deleteAuditoriaRevision,
  fetchAuditoriaRevisiones,
  upsertAuditoriaRevision,
} from "@/services/auditoria";
import { insertBitacora } from "@/services/bitacora";
import type { AuditoriaRevision, HallazgoAuditoria } from "@/types/auditoria";

const REVISIONES_KEY = ["auditoria", "revisiones"] as const;

/**
 * Hash determinista (djb2) — debe coincidir embarque_id+regla+detalle entre
 * cliente y backend para detectar duplicados consistentemente.
 */
export function hallazgoHash(
  h: Pick<HallazgoAuditoria, "embarque_id" | "regla" | "detalle">,
): string {
  const input = `${h.embarque_id}|${h.regla}|${h.detalle}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

export function useAuditoriaRevisiones() {
  return useQuery({
    queryKey: REVISIONES_KEY,
    queryFn: async (): Promise<Map<string, AuditoriaRevision>> => {
      const list = await fetchAuditoriaRevisiones();
      const map = new Map<string, AuditoriaRevision>();
      for (const r of list) {
        map.set(`${r.embarque_id}|${r.regla}|${r.detalle_hash}`, r);
      }
      return map;
    },
    staleTime: 60_000,
  });
}

export function useMarcarRevisado() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      hallazgo: HallazgoAuditoria;
      accionTomada: string;
    }) => {
      const { hallazgo, accionTomada } = params;
      const detalleHash = hallazgoHash(hallazgo);

      if (!user) throw new Error("Sesión no válida");

      const data = await upsertAuditoriaRevision({
        embarque_id: hallazgo.embarque_id,
        regla: hallazgo.regla,
        detalle_hash: detalleHash,
        detalle: hallazgo.detalle,
        accion_tomada: accionTomada,
        revisado_por: user.id,
        revisado_por_email: user.email ?? "",
      });

      // Bitácora — best effort, no bloquea el éxito.
      try {
        await insertBitacora({
          usuarioId: user.id,
          usuarioEmail: user.email ?? "",
          accion: "marcar_hallazgo_revisado",
          modulo: "auditoria",
          entidadId: hallazgo.embarque_id,
          entidadNombre: `Hallazgo ${hallazgo.regla} — Embarque ${hallazgo.expediente}`,
          detalles: {
            regla: hallazgo.regla,
            severidad: hallazgo.severidad,
            detalle: hallazgo.detalle,
            accion_tomada: accionTomada,
            expediente: hallazgo.expediente,
            cliente_nombre: hallazgo.cliente_nombre,
          },
        });
      } catch (e) {
        console.warn("No se pudo registrar en bitácora:", e);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REVISIONES_KEY });
      queryClient.invalidateQueries({ queryKey: ["auditoria", "embarques"] });
      toast.success("Hallazgo marcado como revisado");
    },
    onError: (err: unknown) => {
      console.error("[useMarcarRevisado] error:", err);
      const e = err as { code?: string; message?: string };
      const isPermiso =
        e?.code === "42501" || /row-level security/i.test(e?.message ?? "");
      toast.error(
        isPermiso
          ? "No tienes permisos para marcar revisado"
          : "Error al marcar revisado",
        {
          description: isPermiso
            ? "Tu rol en esta organización no permite esta acción. Contacta a un administrador."
            : e?.message ?? "Error desconocido",
        },
      );
    },
  });
}

export function useDesmarcarRevisado() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (revisionId: string) => {
      await deleteAuditoriaRevision(revisionId);

      try {
        if (user) {
          await insertBitacora({
            usuarioId: user.id,
            usuarioEmail: user.email ?? "",
            accion: "desmarcar_hallazgo_revisado",
            modulo: "auditoria",
            entidadId: null,
            entidadNombre: `Revisión ${revisionId}`,
            detalles: { revision_id: revisionId },
          });
        }
      } catch (e) {
        console.warn("No se pudo registrar en bitácora:", e);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REVISIONES_KEY });
      queryClient.invalidateQueries({ queryKey: ["auditoria", "embarques"] });
      toast.success("Marca de revisión eliminada");
    },
    onError: (err: Error) => {
      console.error("[useDesmarcarRevisado] error:", err);
      toast.error("Error al eliminar marca", { description: err.message });
    },
  });
}

export function revisionKey(
  h: Pick<HallazgoAuditoria, "embarque_id" | "regla" | "detalle">,
): string {
  return `${h.embarque_id}|${h.regla}|${hallazgoHash(h)}`;
}

export const AUDITORIA_REVISIONES_KEY = REVISIONES_KEY;
