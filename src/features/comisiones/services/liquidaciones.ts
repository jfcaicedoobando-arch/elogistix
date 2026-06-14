/**
 * Servicio de liquidaciones de comisión: lista, RPC de generación, registro de pago.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

export type LiquidacionRow = Tables<"liquidaciones_comision">;

export async function fetchLiquidaciones(): Promise<LiquidacionRow[]> {
  const { data, error } = await supabase
    .from("liquidaciones_comision")
    .select("*")
    .order("periodo", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as LiquidacionRow[];
}

export interface GenerarLiquidacionParams {
  vendedora_id: string;
  periodo: string;
  organization_id: string;
}

export async function generarLiquidacion(p: GenerarLiquidacionParams): Promise<string> {
  const { data, error } = await supabase.rpc("generar_liquidacion_comision", {
    p_vendedora_id: p.vendedora_id,
    p_periodo: p.periodo,
    p_organization_id: p.organization_id,
  });
  if (error) throw error;
  return data as string;
}

export interface RegistrarPagoLiquidacionParams {
  id: string;
  fecha_pago: string;
  metodo_pago: string;
  referencia: string;
  notas?: string;
}

export async function registrarPagoLiquidacion(p: RegistrarPagoLiquidacionParams): Promise<void> {
  const changes: TablesUpdate<"liquidaciones_comision"> = {
    fecha_pago: p.fecha_pago,
    metodo_pago: p.metodo_pago,
    referencia: p.referencia,
    notas: p.notas ?? null,
  };
  const { error } = await supabase.from("liquidaciones_comision").update(changes).eq("id", p.id);
  if (error) throw error;
}
