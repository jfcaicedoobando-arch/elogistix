/**
 * Hooks consolidados para el Dashboard del CRM (Sprint A — 11.3.0).
 * Reemplaza el placeholder "Próximas fases" con widgets accionables.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  topDeals: Array<{
    id: string;
    nombre: string;
    cliente_nombre: string;
    monto_estimado: number;
    moneda: string;
    probabilidad: number;
    ponderado: number;
  }>;
  embudo: Array<{ etapa_id: string; nombre: string; color: string; tipo: string; count: number; monto: number }>;
}

function isoDaysFromNow(d: number): string {
  const t = new Date();
  t.setDate(t.getDate() + d);
  return t.toISOString().slice(0, 10);
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

      type OpRow = {
        id: string; nombre: string; cliente_nombre: string;
        monto_estimado: number; moneda: string; probabilidad: number;
        fecha_estimada_cierre: string | null; etapa_id: string;
      };
      const opsAbiertas = (opsAbiertasQ.data ?? []) as OpRow[];
      const pipelinePonderado = opsAbiertas.reduce(
        (s, o) => s + Number(o.monto_estimado ?? 0) * (Number(o.probabilidad ?? 0) / 100),
        0,
      );

      const topDeals = [...opsAbiertas]
        .map((o) => ({
          id: o.id,
          nombre: o.nombre,
          cliente_nombre: o.cliente_nombre,
          monto_estimado: Number(o.monto_estimado ?? 0),
          moneda: o.moneda,
          probabilidad: Number(o.probabilidad ?? 0),
          ponderado: Number(o.monto_estimado ?? 0) * (Number(o.probabilidad ?? 0) / 100),
        }))
        .sort((a, b) => b.ponderado - a.ponderado)
        .slice(0, 5);

      type EtapaRow = { id: string; nombre: string; color: string; tipo: string };
      const etapas = (etapasQ.data ?? []) as EtapaRow[];
      const embudo = etapas.map((et) => {
        const ops = opsAbiertas.filter((o) => o.etapa_id === et.id);
        return {
          etapa_id: et.id,
          nombre: et.nombre,
          color: et.color,
          tipo: et.tipo,
          count: ops.length,
          monto: ops.reduce((s, o) => s + Number(o.monto_estimado ?? 0), 0),
        };
      });

      return {
        kpis: {
          leads: leadsCountQ.count ?? 0,
          oportunidadesAbiertas: opsAbiertas.length,
          actividadesPendientes: actsPendQ.count ?? 0,
          pipelinePonderado,
        },
        misActividadesHoy: (misActsQ.data ?? []) as CrmDashboardData["misActividadesHoy"],
        cerrandoEstaSemana: (cerrandoQ.data ?? []).map((o: { id: string; nombre: string; cliente_nombre: string; monto_estimado: number; moneda: string; fecha_estimada_cierre: string | null; probabilidad: number }) => ({
          id: o.id, nombre: o.nombre, cliente_nombre: o.cliente_nombre,
          monto_estimado: Number(o.monto_estimado ?? 0), moneda: o.moneda,
          fecha_estimada_cierre: o.fecha_estimada_cierre, probabilidad: Number(o.probabilidad ?? 0),
        })),
        leadsSinContactar: (leadsViejosQ.data ?? []) as CrmDashboardData["leadsSinContactar"],
        topDeals,
        embudo,
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
