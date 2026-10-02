/**
 * Servicio CRM — Reportes dinámicos (Fase 7). Capa de I/O para
 * `crm_tableros`, `crm_reportes` y el RPC `crm_reporte_datos`.
 * Escribe sólo el súper administrador (lo impone la RLS); leen los miembros.
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap } from "@/lib/supabase/response";
import {
  filtroAJson,
  filtroDesdeJson,
  type CrmReporteRow,
  type CrmTableroRow,
  type FiltroReporte,
  type MedidaReporte,
  type ObjetoReporte,
  type ReporteDato,
  type TipoGrafica,
} from "./tiposReportes";

export interface ReporteInput {
  nombre: string;
  objeto: ObjetoReporte;
  medida: MedidaReporte;
  agrupacion: string;
  tipoGrafica: TipoGrafica;
  filtro: FiltroReporte;
}

// ---------- Tableros ----------

export async function listTableros(): Promise<CrmTableroRow[]> {
  const { data, error } = await supabase
    .from("crm_tableros")
    .select("id, organization_id, nombre, orden, created_at")
    .is("deleted_at", null)
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CrmTableroRow[];
}

export async function crearTablero(nombre: string): Promise<string> {
  const row = (await unwrap(
    supabase.from("crm_tableros").insert({ nombre }).select("id").single(),
  )) as { id: string };
  return row.id;
}

export async function renombrarTablero(id: string, nombre: string): Promise<void> {
  const { error } = await supabase.from("crm_tableros").update({ nombre }).eq("id", id);
  if (error) throw error;
}

export async function eliminarTablero(id: string): Promise<void> {
  const { error } = await supabase.from("crm_tableros").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

// ---------- Reportes ----------

interface ReporteDbRow {
  id: string;
  tablero_id: string;
  organization_id: string;
  nombre: string;
  objeto: string;
  medida: string;
  agrupacion: string;
  filtro: unknown;
  tipo_grafica: string;
  posicion: number;
}

function mapReporte(r: ReporteDbRow): CrmReporteRow {
  return {
    ...r,
    objeto: r.objeto as ObjetoReporte,
    medida: r.medida as MedidaReporte,
    tipo_grafica: r.tipo_grafica as TipoGrafica,
    filtro: filtroDesdeJson(r.filtro),
  };
}

export async function listReportes(tableroId: string): Promise<CrmReporteRow[]> {
  const { data, error } = await supabase
    .from("crm_reportes")
    .select("id, tablero_id, organization_id, nombre, objeto, medida, agrupacion, filtro, tipo_grafica, posicion")
    .eq("tablero_id", tableroId)
    .is("deleted_at", null)
    .order("posicion", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as ReporteDbRow[]).map(mapReporte);
}

export async function crearReporte(tableroId: string, input: ReporteInput): Promise<void> {
  const { error } = await supabase.from("crm_reportes").insert({
    tablero_id: tableroId,
    nombre: input.nombre.trim(),
    objeto: input.objeto,
    medida: input.medida,
    agrupacion: input.agrupacion,
    tipo_grafica: input.tipoGrafica,
    filtro: filtroAJson(input.filtro),
  });
  if (error) throw error;
}

export async function actualizarReporte(id: string, input: ReporteInput): Promise<void> {
  const { error } = await supabase
    .from("crm_reportes")
    .update({
      nombre: input.nombre.trim(),
      objeto: input.objeto,
      medida: input.medida,
      agrupacion: input.agrupacion,
      tipo_grafica: input.tipoGrafica,
      filtro: filtroAJson(input.filtro),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function eliminarReporte(id: string): Promise<void> {
  const { error } = await supabase.from("crm_reportes").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

// ---------- Datos ----------

export async function fetchReporteDatos(reporteId: string): Promise<ReporteDato[]> {
  const { data, error } = await supabase.rpc("crm_reporte_datos", { p_reporte_id: reporteId });
  if (error) throw error;
  return (data ?? []).map((f) => ({ etiqueta: f.etiqueta ?? "Sin dato", valor: Number(f.valor ?? 0) }));
}
