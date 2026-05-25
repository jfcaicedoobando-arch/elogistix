/**
 * Comentarios de oportunidad CRM (Sprint D).
 * Lectura paginada simple + alta. La notificación al vendedor se dispara por
 * trigger en BD (`crm_notify_comentario_oportunidad`).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/query";

const COLS = "id, oportunidad_id, autor_id, autor_email, texto, created_at";

export interface ComentarioRow {
  id: string;
  oportunidad_id: string;
  autor_id: string;
  autor_email: string;
  texto: string;
  created_at: string;
}

export function useComentariosOportunidad(oportunidadId: string | undefined, limit = 50) {
  return useQuery<ComentarioRow[]>({
    queryKey: queryKeys.crm.comentarios.byOportunidad(oportunidadId ?? "", limit),
    enabled: !!oportunidadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_comentarios_oportunidad")
        .select(COLS)
        .eq("oportunidad_id", oportunidadId!)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as ComentarioRow[];
    },
  });
}

export function useCrearComentarioOportunidad() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ oportunidadId, texto }: { oportunidadId: string; texto: string }) => {
      if (!user?.id) throw new Error("Sesión no encontrada");
      const limpio = texto.trim();
      if (!limpio) throw new Error("El comentario no puede estar vacío");
      const { error } = await supabase.from("crm_comentarios_oportunidad").insert({
        oportunidad_id: oportunidadId,
        autor_id: user.id,
        autor_email: user.email ?? "",
        texto: limpio,
      });
      if (error) throw error;
    },
    onSuccess: (_v, vars) => {
      qc.invalidateQueries({ queryKey: ["crm", "comentarios-op", vars.oportunidadId], exact: false });
    },
  });
}
