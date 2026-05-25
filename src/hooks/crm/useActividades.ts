/**
 * Hooks de Actividades CRM (Fase 4) — polimórficas vía entidad_tipo + entidad_id.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";

export type CrmActividadRow = Database["public"]["Tables"]["crm_actividades"]["Row"];
export type CrmActividadTipo = Database["public"]["Enums"]["crm_actividad_tipo"];
export type CrmEntidadTipo = Database["public"]["Enums"]["crm_entidad_tipo"];

export const ACTIVIDAD_TIPOS: CrmActividadTipo[] = [
  "llamada",
  "email",
  "reunion",
  "tarea",
  "nota",
];

export const ENTIDAD_TIPOS: CrmEntidadTipo[] = ["lead", "oportunidad", "cliente", "contacto"];

const COLS =
  "id, tipo, asunto, descripcion, entidad_tipo, entidad_id, fecha_programada, fecha_completada, duracion_min, resultado, responsable_id, responsable_email, created_at, updated_at";

export interface ActividadFiltros {
  search?: string;
  tipo?: CrmActividadTipo | "todos";
  estado?: "pendientes" | "completadas" | "todas";
  responsable?: "mias" | "todos";
  entidadTipo?: CrmEntidadTipo;
  entidadId?: string;
  page?: number;
  pageSize?: number;
}

export function useActividades(f: ActividadFiltros = {}) {
  const { user } = useAuth();
  const {
    search = "",
    tipo = "todos",
    estado = "todas",
    responsable = "todos",
    entidadTipo,
    entidadId,
    page = 0,
    pageSize = 25,
  } = f;
  return useQuery({
    queryKey: ["crm", "actividades", { search, tipo, estado, responsable, entidadTipo, entidadId, page, pageSize, uid: user?.id }],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase
        .from("crm_actividades")
        .select(COLS, { count: "exact" })
        .order("fecha_programada", { ascending: true, nullsFirst: false });
      if (search.trim()) q = q.ilike("asunto", `%${search.trim()}%`);
      if (tipo !== "todos") q = q.eq("tipo", tipo);
      if (estado === "pendientes") q = q.is("fecha_completada", null);
      if (estado === "completadas") q = q.not("fecha_completada", "is", null);
      if (responsable === "mias" && user?.id) q = q.eq("responsable_id", user.id);
      if (entidadTipo) q = q.eq("entidad_tipo", entidadTipo);
      if (entidadId) q = q.eq("entidad_id", entidadId);
      const from = page * pageSize;
      q = q.range(from, from + pageSize - 1);
      const { data, count, error } = await q;
      if (error) throw error;
      return { data: (data ?? []) as CrmActividadRow[], count: count ?? 0 };
    },
  });
}

export type ActividadInput = {
  tipo: CrmActividadTipo;
  asunto: string;
  descripcion?: string;
  entidad_tipo: CrmEntidadTipo;
  entidad_id: string;
  fecha_programada?: string | null;
  duracion_min?: number | null;
  resultado?: string;
};

export function useCrearActividad() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: ActividadInput) => {
      const { data, error } = await supabase
        .from("crm_actividades")
        .insert({
          ...input,
          descripcion: input.descripcion ?? "",
          resultado: input.resultado ?? "",
          responsable_id: user?.id ?? null,
          responsable_email: user?.email ?? "",
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm", "actividades"] });
      qc.invalidateQueries({ queryKey: ["crm", "kpis"] });
    },
  });
}

export function useCompletarActividad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, resultado }: { id: string; resultado?: string }) => {
      const { error } = await supabase
        .from("crm_actividades")
        .update({ fecha_completada: new Date().toISOString(), resultado: resultado ?? "" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "actividades"] }),
  });
}

export function useEliminarActividad() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("crm_actividades")
        .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "actividades"] }),
  });
}
