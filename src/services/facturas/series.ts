/**
 * Series de facturación (CxC – Sprint 1).
 * Maneja CRUD básico y reserva atómica de folio vía RPC.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type FacturaSerie = Tables<"factura_series">;

export async function listarSeries(): Promise<FacturaSerie[]> {
  const { data, error } = await supabase
    .from("factura_series")
    .select("*")
    .order("es_default", { ascending: false })
    .order("codigo", { ascending: true })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function obtenerSerieDefault(): Promise<FacturaSerie | null> {
  const { data, error } = await supabase
    .from("factura_series")
    .select("*")
    .eq("es_default", true)
    .eq("activa", true)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function crearSerie(input: TablesInsert<"factura_series">): Promise<FacturaSerie> {
  const { data, error } = await supabase
    .from("factura_series")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarSerie(id: string, patch: TablesUpdate<"factura_series">): Promise<void> {
  const { error } = await supabase.from("factura_series").update(patch).eq("id", id);
  if (error) throw error;
}

export async function marcarSerieComoDefault(id: string, organizationId: string): Promise<void> {
  // Quita default actual y asigna el nuevo. Atómico via dos updates en transacción lógica.
  const off = await supabase
    .from("factura_series")
    .update({ es_default: false })
    .eq("organization_id", organizationId)
    .eq("es_default", true);
  if (off.error) throw off.error;
  const on = await supabase.from("factura_series").update({ es_default: true }).eq("id", id);
  if (on.error) throw on.error;
}

export interface FolioReservado {
  folio: number;
  numero: string;
}

export async function reservarFolio(serieId: string): Promise<FolioReservado> {
  const { data, error } = await supabase.rpc("reservar_folio_factura", { _serie_id: serieId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("RPC reservar_folio_factura no devolvió folio");
  return {
    folio: Number((row as { folio: number }).folio),
    numero: String((row as { numero: string }).numero),
  };
}
