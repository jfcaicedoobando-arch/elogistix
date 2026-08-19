/**
 * Servicio CRM — Presupuesto mensual y metas de actividad (Etapa 3 CRM Hunter).
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap, run } from "@/lib/supabase/response";
import type { Moneda } from "@/types/db";

export type PeriodoMeta = "semanal" | "dia_30" | "dia_60" | "dia_90" | "trimestre";

export const PERIODOS_META: { value: PeriodoMeta; label: string }[] = [
  { value: "semanal", label: "Semanal" },
  { value: "dia_30", label: "30 días" },
  { value: "dia_60", label: "60 días" },
  { value: "dia_90", label: "90 días" },
  { value: "trimestre", label: "Trimestre" },
];

export interface PresupuestoMes {
  id: string;
  anio: number;
  mes: number;
  monto: number;
  moneda: Moneda;
}

export interface MetaActividad {
  id: string;
  periodo: PeriodoMeta;
  icp_validados: number;
  contactadas: number;
  reuniones: number;
  cotizaciones: number;
}

export async function fetchPresupuestoAnio(anio: number): Promise<PresupuestoMes[]> {
  const data = await unwrap(
    supabase
      .from("crm_presupuesto_mensual")
      .select("id, anio, mes, monto, moneda")
      .eq("anio", anio)
      .order("mes", { ascending: true }),
  );
  return (data ?? []) as PresupuestoMes[];
}

export async function upsertPresupuestoMes(params: {
  organizationId: string;
  anio: number;
  mes: number;
  monto: number;
  moneda: Moneda;
}): Promise<void> {
  await run(
    supabase.from("crm_presupuesto_mensual").upsert(
      {
        organization_id: params.organizationId,
        anio: params.anio,
        mes: params.mes,
        monto: params.monto,
        moneda: params.moneda,
      },
      { onConflict: "organization_id,anio,mes" },
    ),
  );
}

export async function fetchMetasActividad(): Promise<MetaActividad[]> {
  const data = await unwrap(
    supabase
      .from("crm_metas_actividad")
      .select("id, periodo, icp_validados, contactadas, reuniones, cotizaciones"),
  );
  return (data ?? []) as MetaActividad[];
}

export async function upsertMetaActividad(params: {
  organizationId: string;
  periodo: PeriodoMeta;
  icp_validados: number;
  contactadas: number;
  reuniones: number;
  cotizaciones: number;
}): Promise<void> {
  await run(
    supabase.from("crm_metas_actividad").upsert(
      {
        organization_id: params.organizationId,
        periodo: params.periodo,
        icp_validados: params.icp_validados,
        contactadas: params.contactadas,
        reuniones: params.reuniones,
        cotizaciones: params.cotizaciones,
      },
      { onConflict: "organization_id,periodo" },
    ),
  );
}
