/**
 * Hooks de Oportunidades CRM (Fase 3).
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

export type CrmOportunidadRow = Database["public"]["Tables"]["crm_oportunidades"]["Row"];
export type Moneda = "MXN" | "USD" | "EUR";

const COLS =
  "id, nombre, cliente_id, cliente_nombre, lead_id, vendedor_id, vendedor_email, etapa_id, monto_estimado, moneda, probabilidad, fecha_estimada_cierre, fecha_cierre_real, motivo_perdida_id, modo, tipo_carga, origen, destino, notas, created_at, updated_at";

export interface OportunidadFiltros {
  search?: string;
  etapaId?: string | "todas";
  vendedorId?: string | "todos";
  page?: number;
  pageSize?: number;
}

export function useOportunidades(f: OportunidadFiltros = {}) {
  const { search = "", etapaId = "todas", vendedorId = "todos", page = 0, pageSize = 50 } = f;
  return useQuery({
    queryKey: ["crm", "oportunidades", { search, etapaId, vendedorId, page, pageSize }],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase
        .from("crm_oportunidades")
        .select(COLS, { count: "exact" })
        .order("created_at", { ascending: false });
      if (search.trim()) {
        const t = `%${search.trim()}%`;
        q = q.or(`nombre.ilike.${t},cliente_nombre.ilike.${t}`);
      }
      if (etapaId !== "todas") q = q.eq("etapa_id", etapaId);
      if (vendedorId !== "todos") q = q.eq("vendedor_id", vendedorId);
      const from = page * pageSize;
      q = q.range(from, from + pageSize - 1);
      const { data, count, error } = await q;
      if (error) throw error;
      return { data: (data ?? []) as CrmOportunidadRow[], count: count ?? 0 };
    },
  });
}

export function useOportunidad(id: string | undefined) {
  return useQuery<CrmOportunidadRow | null>({
    queryKey: ["crm", "oportunidades", "detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_oportunidades")
        .select(COLS)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as CrmOportunidadRow | null;
    },
  });
}

export type OportunidadInput = {
  nombre: string;
  cliente_id?: string | null;
  cliente_nombre?: string;
  lead_id?: string | null;
  etapa_id: string;
  monto_estimado?: number;
  moneda?: Moneda;
  probabilidad?: number;
  fecha_estimada_cierre?: string | null;
  modo?: string;
  tipo_carga?: string;
  origen?: string;
  destino?: string;
  notas?: string;
  vendedor_id?: string | null;
  vendedor_email?: string;
};

export function useCrearOportunidad() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: OportunidadInput) => {
      const { data, error } = await supabase
        .from("crm_oportunidades")
        .insert({
          ...input,
          cliente_nombre: input.cliente_nombre ?? "",
          monto_estimado: input.monto_estimado ?? 0,
          moneda: input.moneda ?? "MXN",
          probabilidad: input.probabilidad ?? 0,
          modo: input.modo ?? "",
          tipo_carga: input.tipo_carga ?? "",
          origen: input.origen ?? "",
          destino: input.destino ?? "",
          notas: input.notas ?? "",
          vendedor_id: input.vendedor_id !== undefined ? input.vendedor_id : (user?.id ?? null),
          vendedor_email: input.vendedor_email ?? user?.email ?? "",
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm", "oportunidades"] });
      qc.invalidateQueries({ queryKey: ["crm", "kpis"] });
      qc.invalidateQueries({ queryKey: ["crm", "dashboard"] });
    },
  });
}

export function useActualizarOportunidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<OportunidadInput & { motivo_perdida_id?: string | null; fecha_cierre_real?: string | null }> }) => {
      const { error } = await supabase.from("crm_oportunidades").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["crm", "oportunidades"] });
      qc.invalidateQueries({ queryKey: ["crm", "oportunidades", "detail", vars.id] });
      qc.invalidateQueries({ queryKey: ["crm", "kpis"] });
    },
  });
}

export function useMoverEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, etapa_id, probabilidad }: { id: string; etapa_id: string; probabilidad?: number }) => {
      const patch: Record<string, unknown> = { etapa_id };
      if (typeof probabilidad === "number") patch.probabilidad = probabilidad;
      const { error } = await supabase.from("crm_oportunidades").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "oportunidades"] }),
  });
}

export function useEliminarOportunidad() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("crm_oportunidades")
        .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "oportunidades"] }),
  });
}
