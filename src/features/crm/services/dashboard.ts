/**
 * Servicio CRM — Dashboard. Agregaciones I/O.
 */
import { supabase } from "@/integrations/supabase/client";
import { CRM_ACTIVIDADES_COLUMNS_MIN } from "./crmActividadesColumns";
import { filtroResponsable } from "./actividadesQueryHelpers";
import {
  isoDaysFromNow,
  computePipelinePonderado,
  computeTopDeals,
  computeEmbudo,
  type OpRow,
  type EtapaRow,
  type TopDeal,
  type EmbudoRow,
} from "@/features/crm/domain/dashboardAggregates";
import { todayLocalISO } from "@/lib/date/today";
import { leerTodasLasPaginas } from "@/lib/supabase/paginado";

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

const OPS_ABIERTAS_SELECT =
  "id, nombre, cliente_nombre, monto_estimado, moneda, probabilidad, fecha_estimada_cierre, etapa_id, crm_etapas_pipeline!inner(id, nombre, color, tipo)";

/**
 * Ronda YAGNI · defecto 2: las oportunidades abiertas alimentan KPI, pipeline
 * ponderado, top deals y embudo. Antes se pedían sin paginar, así que PostgREST
 * cortaba en `max-rows` SIN error y todos esos números salían parciales.
 */
async function fetchOportunidadesAbiertas(): Promise<OpRow[]> {
  const filas = await leerTodasLasPaginas<unknown>("crm.oportunidadesAbiertas", (desde, hasta) =>
    supabase
      .from("crm_oportunidades")
      .select(OPS_ABIERTAS_SELECT)
      .is("deleted_at", null)
      .eq("crm_etapas_pipeline.tipo", "abierta")
      .order("id", { ascending: true })
      .range(desde, hasta),
  );
  // SAFE-CAST: el embed `crm_etapas_pipeline!inner` produce un shape que el
  // tipo generado no captura; `OpRow` declara lo que consumimos.
  return filas as OpRow[];
}

/** Lanza el primer error de las respuestas: un fallo no puede verse como cero. */
function assertSinErrores(respuestas: ReadonlyArray<{ error: unknown }>): void {
  for (const r of respuestas) {
    if (r.error) throw r.error;
  }
}

export async function fetchCrmDashboard(
  userId: string | undefined,
  userEmail?: string | null,
): Promise<CrmDashboardData> {
  const hoyInicio = new Date(); hoyInicio.setHours(0, 0, 0, 0);
  const hoyFin = new Date(); hoyFin.setHours(23, 59, 59, 999);
  const hace7 = new Date(); hace7.setDate(hace7.getDate() - 7);

  const [leadsCountQ, opsAbiertas, actsPendQ, misActsQ, cerrandoQ, leadsViejosQ, etapasQ] = await Promise.all([
    supabase.from("crm_leads").select("id", { count: "exact", head: true }).is("deleted_at", null),
    fetchOportunidadesAbiertas(),
    supabase
      .from("crm_actividades")
      .select("id", { count: "exact", head: true })
      .is("fecha_completada", null)
      .is("deleted_at", null),
    // FIX-4 (auditoría): mismo filtro de responsable que `listActividades`
    // (id O correo cuando el id es null) — antes se perdían actividades
    // legadas asignadas sólo por correo.
    userId
      ? supabase
          .from("crm_actividades")
          .select(CRM_ACTIVIDADES_COLUMNS_MIN)
          .is("fecha_completada", null)
          .is("deleted_at", null)
          .or(filtroResponsable(userId, userEmail))
          .gte("fecha_programada", hoyInicio.toISOString())
          .lte("fecha_programada", hoyFin.toISOString())
          .order("fecha_programada", { ascending: true })
          .limit(10)
      : Promise.resolve({ data: [] as CrmDashboardData["misActividadesHoy"], error: null }),
    supabase
      .from("crm_oportunidades")
      .select("id, nombre, cliente_nombre, monto_estimado, moneda, probabilidad, fecha_estimada_cierre, crm_etapas_pipeline!inner(tipo)")
      .eq("crm_etapas_pipeline.tipo", "abierta")
      .is("deleted_at", null)
      .gte("fecha_estimada_cierre", todayLocalISO())
      .lte("fecha_estimada_cierre", isoDaysFromNow(7))
      .order("fecha_estimada_cierre", { ascending: true })
      .limit(10),
    supabase
      .from("crm_leads")
      .select("id, empresa, contacto, fuente, created_at")
      .eq("estado", "Nuevo")
      .is("deleted_at", null)
      .lte("created_at", hace7.toISOString())
      .order("created_at", { ascending: true })
      .limit(10),
    supabase.from("crm_etapas_pipeline").select("id, nombre, color, tipo, orden").is("deleted_at", null).eq("activa", true).order("orden", { ascending: true }),
  ]);

  // Defecto 2: antes cualquier error (RLS, red) se leía como `?? 0` / lista
  // vacía y el tablero mostraba ceros creíbles. Ahora se propaga.
  assertSinErrores([leadsCountQ, actsPendQ, misActsQ, cerrandoQ, leadsViejosQ, etapasQ]);
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
      id: o.id,
      nombre: o.nombre,
      cliente_nombre: o.cliente_nombre,
      monto_estimado: Number(o.monto_estimado ?? 0),
      moneda: o.moneda,
      fecha_estimada_cierre: o.fecha_estimada_cierre,
      probabilidad: Number(o.probabilidad ?? 0),
    })),
    leadsSinContactar: (leadsViejosQ.data ?? []) as CrmDashboardData["leadsSinContactar"],
    topDeals: computeTopDeals(opsAbiertas, 5),
    embudo: computeEmbudo(opsAbiertas, etapas),
  };
}
