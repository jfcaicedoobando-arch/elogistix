import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { HallazgoAuditoria, ReglaAuditoria } from "./useAuditoria";

export interface AuditoriaRevision {
  id: string;
  embarque_id: string;
  regla: string;
  detalle_hash: string;
  detalle: string;
  accion_tomada: string;
  revisado_por: string;
  revisado_por_email: string;
  created_at: string;
  updated_at: string;
}

const REVISIONES_KEY = ["auditoria", "revisiones"] as const;

/**
 * Hash determinista (djb2) — debe coincidir embarque_id+regla+detalle entre
 * cliente y backend para detectar duplicados consistentemente.
 */
export function hallazgoHash(h: Pick<HallazgoAuditoria, "embarque_id" | "regla" | "detalle">): string {
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
      const { data, error } = await supabase
        .from("auditoria_revisiones")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const map = new Map<string, AuditoriaRevision>();
      for (const r of (data ?? []) as AuditoriaRevision[]) {
        map.set(`${r.embarque_id}|${r.regla}|${r.detalle_hash}`, r);
      }
      return map;
    },
    staleTime: 60_000,
  });
}

export function useMarcarRevisado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      hallazgo: HallazgoAuditoria;
      accionTomada: string;
    }) => {
      const { hallazgo, accionTomada } = params;
      const detalleHash = hallazgoHash(hallazgo);

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("Sesión no válida");

      const { data, error } = await supabase
        .from("auditoria_revisiones")
        .upsert(
          {
            embarque_id: hallazgo.embarque_id,
            regla: hallazgo.regla,
            detalle_hash: detalleHash,
            detalle: hallazgo.detalle,
            accion_tomada: accionTomada,
            revisado_por: user.id,
            revisado_por_email: user.email ?? "",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,embarque_id,regla,detalle_hash" },
        )
        .select()
        .single();

      if (error) throw error;

      // Bitácora — best effort, no bloquea el éxito
      try {
        await supabase.from("bitacora_actividad").insert({
          usuario_id: user.id,
          usuario_email: user.email ?? "",
          accion: "marcar_hallazgo_revisado",
          modulo: "auditoria",
          entidad_nombre: `Hallazgo ${hallazgo.regla} — Embarque ${hallazgo.expediente}`,
          entidad_id: hallazgo.embarque_id,
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
      toast.success("Hallazgo marcado como revisado");
    },
    onError: (err: Error) => {
      toast.error("Error al marcar revisado", { description: err.message });
    },
  });
}

export function useDesmarcarRevisado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (revisionId: string) => {
      const { error } = await supabase
        .from("auditoria_revisiones")
        .delete()
        .eq("id", revisionId);
      if (error) throw error;

      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (user) {
          await supabase.from("bitacora_actividad").insert({
            usuario_id: user.id,
            usuario_email: user.email ?? "",
            accion: "desmarcar_hallazgo_revisado",
            modulo: "auditoria",
            entidad_nombre: `Revisión ${revisionId}`,
            entidad_id: null,
            detalles: { revision_id: revisionId },
          });
        }
      } catch (e) {
        console.warn("No se pudo registrar en bitácora:", e);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REVISIONES_KEY });
      toast.success("Marca de revisión eliminada");
    },
    onError: (err: Error) => {
      toast.error("Error al eliminar marca", { description: err.message });
    },
  });
}

export function revisionKey(h: Pick<HallazgoAuditoria, "embarque_id" | "regla" | "detalle">): string {
  return `${h.embarque_id}|${h.regla}|${hallazgoHash(h)}`;
}

export const AUDITORIA_REVISIONES_KEY = REVISIONES_KEY;
