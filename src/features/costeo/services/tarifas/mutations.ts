/**
 * Mutaciones de tarifas marítimas + recargos hijos. Divisa siempre USD (Fase 3).
 */
import { supabase } from "@/integrations/supabase/client";
import type { CosteoTarifa } from "@/features/costeo/types";

export interface TarifaRecargoInput {
  concepto: string;
  lado?: "origen" | "destino";
  monto: number;
  moneda?: string;
  incluido_en_total?: boolean;
}

export interface TarifaInput {
  agente_id: string;
  naviera_id: string;
  ruta_id: string;
  tipo_contenedor_id: string;
  flete_base: number;
  dias_libres_demoras: number;
  vigente_desde: string;
  vigente_hasta: string;
  transit_time_dias?: number | null;
  notas?: string | null;
  recargos: TarifaRecargoInput[];
}

function buildRecargoRows(tarifaId: string, recargos: TarifaRecargoInput[]) {
  return recargos
    .filter((r) => r.concepto.trim() && Number(r.monto) > 0)
    .map((r) => ({
      tarifa_id: tarifaId,
      concepto: r.concepto.trim(),
      lado: r.lado ?? "origen",
      monto: Number(r.monto) || 0,
      moneda: "USD",
      incluido_en_total: r.incluido_en_total ?? true,
    }));
}

export async function insertTarifaConRecargos(
  organizationId: string,
  input: TarifaInput,
): Promise<CosteoTarifa> {
  const { recargos, ...tarifa } = input;
  const { data, error } = await supabase
    .from("costeo_tarifas")
    .insert({
      ...tarifa,
      moneda: "USD",
      estado: "vigente",
      organization_id: organizationId,
    })
    .select("*")
    .single();
  if (error) throw error;

  const rows = buildRecargoRows(data.id, recargos);
  if (rows.length > 0) {
    const { error: errRec } = await supabase.from("costeo_tarifa_recargos").insert(rows);
    if (errRec) throw errRec;
  }
  return data as CosteoTarifa;
}

export async function updateTarifaConRecargos(
  id: string,
  input: TarifaInput,
): Promise<void> {
  const { recargos, ...tarifa } = input;
  const { error } = await supabase
    .from("costeo_tarifas")
    .update({ ...tarifa, moneda: "USD" })
    .eq("id", id);
  if (error) throw error;

  // Sincronizar recargos: borrar todos los existentes y reinsertar los nuevos.
  const { error: errDel } = await supabase
    .from("costeo_tarifa_recargos")
    .delete()
    .eq("tarifa_id", id);
  if (errDel) throw errDel;

  const rows = buildRecargoRows(id, recargos);
  if (rows.length > 0) {
    const { error: errRec } = await supabase.from("costeo_tarifa_recargos").insert(rows);
    if (errRec) throw errRec;
  }
}

export async function marcarTarifaReemplazada(id: string): Promise<void> {
  const { error } = await supabase
    .from("costeo_tarifas")
    .update({ estado: "reemplazada" })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTarifa(id: string): Promise<void> {
  const { error } = await supabase.from("costeo_tarifas").delete().eq("id", id);
  if (error) throw error;
}
