/**
 * Hooks consolidados para el Dashboard del CRM.
 * Agregaciones puras en `lib/crm/dashboardAggregates.ts`.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  isoDaysFromNow,
  computePipelinePonderado,
  computeTopDeals,
  computeEmbudo,
  type OpRow,
  type EtapaRow,
  type TopDeal,
  type EmbudoRow,
} from "@/lib/crm/dashboardAggregates";

export interface CrmDashboardData {
  kpis: {
    leads: number;
    oportunidadesAbiertas: number;
    actividadesPendientes: number;
    pipelinePonderado: number;
  };
  misActividadesHoy: Array<{
    id: string;
    asunto: string;
    tipo: string;
    fecha_programada: string | null;
    entidad_tipo: string;
    entidad_id: string;
  }>;
  cerrandoEstaSemana: Array<{
    id: string;
    nombre: string;
    cliente_nombre: string;
    monto_estimado: number;
    moneda: string;
    fecha_estimada_cierre: string | null;
    probabilidad: number;
  }>;
  leadsSinContactar: Array<{
    id: string;
    empresa: string;
    contacto: string;
    fuente: string;
    created_at: string;
  }>;
  topDeals: TopDeal[];
  embudo: EmbudoRow[];
}

export function useCrmDashboardData() {
  const { user } = useAuth();
  return useQuery<CrmDashboardData>({
    queryKey: ["crm", "dashboard", user?.id],
    queryFn: async () => {
      const hoyInicio = new Date(); hoyInicio.setHours(0, 0, 0, 0);
      const hoyFin = new Date(); hoyFin.setHours(23, 59, 59, 999);
      const hace7 = new Date(); hace7.setDate(hace7.getDate() - 7);

      const [
        leadsCountQ,
        opsAbiertasQ,
        actsPendQ,
        misActsQ,
        cerrandoQ,
        leadsViejosQ,
        etapasQ,
      ] = await Promise.all([
        supabase.from("crm_leads").select("id", { count: "exact", head: true }),
        supabase
          .from("crm_oportunidades")
          .select("id, nombre, cliente_nombre, monto_estimado, moneda, probabilidad, fecha_estimada_cierre, etapa_id, crm_etapas_pipeline!inner(id, nombre, color, tipo)")
          .eq("crm_etapas_pipeline.tipo", "abierta"),
        supabase
          .from("crm_actividades")
          .select("id", { count: "exact", head: true })
          .is("fecha_completada", null),
        supabase
          .from("crm_actividades")
          .select("id, asunto, tipo, fecha_programada, entidad_tipo, entidad_id")
          .is("fecha_completada", null)
          .eq("responsable_id", user?.id ?? "")
          .gte("fecha_programada", hoyInicio.toISOString())
          .lte("fecha_programada", hoyFin.toISOString())
          .order("fecha_programada", { ascending: true })
          .limit(10),
        supabase
          .from("crm_oportunidades")
          .select("id, nombre, cliente_nombre, monto_estimado, moneda, probabilidad, fecha_estimada_cierre, crm_etapas_pipeline!inner(tipo)")
          .eq("crm_etapas_pipeline.tipo", "abierta")
          .gte("fecha_estimada_cierre", new Date().toISOString().slice(0, 10))
          .lte("fecha_estimada_cierre", isoDaysFromNow(7))
          .order("fecha_estimada_cierre", { ascending: true })
          .limit(10),
        supabase
          .from("crm_leads")
          .select("id, empresa, contacto, fuente, created_at")
          .eq("estado", "Nuevo")
          .lte("created_at", hace7.toISOString())
          .order("created_at", { ascending: true })
          .limit(10),
        supabase.from("crm_etapas_pipeline").select("id, nombre, color, tipo, orden").eq("activa", true).order("orden", { ascending: true }),
      ]);

      const opsAbiertas = (opsAbiertasQ.data ?? []) as OpRow[];
      const etapas = (etapasQ.data ?? []) as EtapaRow[];

      return {
        kpis: {
          leads: leadsCountQ.count ?? 0,
          oportunidadesAbiertas: opsAbiertas.length,
          actividadesPendientes: actsPendQ.count ?? 0,
          pipelinePonderado: computePipelinePonderado(opsAbiertas),
        },
        misActividadesHoy: (misActsQ.data ?? []) as CrmDashboardData["misActividadesHoy"],
        cerrandoEstaSemana: (cerrandoQ.data ?? []).map((o: { id: string; nombre: string; cliente_nombre: string; monto_estimado: number; moneda: string; fecha_estimada_cierre: string | null; probabilidad: number }) => ({
          id: o.id, nombre: o.nombre, cliente_nombre: o.cliente_nombre,
          monto_estimado: Number(o.monto_estimado ?? 0), moneda: o.moneda,
          fecha_estimada_cierre: o.fecha_estimada_cierre, probabilidad: Number(o.probabilidad ?? 0),
        })),
        leadsSinContactar: (leadsViejosQ.data ?? []) as CrmDashboardData["leadsSinContactar"],
        topDeals: computeTopDeals(opsAbiertas, 5),
        embudo: computeEmbudo(opsAbiertas, etapas),
      };
    },
    staleTime: 60_000,
  });
}

/** Conteo de actividades vencidas (no completadas, fecha_programada < ahora) del usuario. */
export function useActividadesVencidasCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["crm", "actividades", "vencidas-count", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("crm_actividades")
        .select("id", { count: "exact", head: true })
        .is("fecha_completada", null)
        .lt("fecha_programada", new Date().toISOString())
        .eq("responsable_id", user!.id);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60_000,
  });
}

/** Lista de actividades vencidas (top 5) para banner del dashboard. */
export function useActividadesVencidasList(limit = 5) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["crm", "actividades", "vencidas-list", user?.id, limit],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_actividades")
        .select("id, asunto, tipo, fecha_programada, entidad_tipo, entidad_id")
        .is("fecha_completada", null)
        .lt("fecha_programada", new Date().toISOString())
        .eq("responsable_id", user!.id)
        .order("fecha_programada", { ascending: true })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}
