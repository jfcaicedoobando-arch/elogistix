/**
 * Acceso a los snapshots inmutables de facturas y proformas (A.4).
 *
 * Los snapshots los congela un trigger BEFORE INSERT/UPDATE al pasar la
 * factura a Emitida/Pagada o la proforma a aprobada/facturada. Esta capa
 * solo expone helpers para leerlos desde la UI/generadores de PDF.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface FacturaSnapshot {
  version: number;
  congelado_at: string;
  estado_al_congelar: string;
  numero: string;
  moneda: "MXN" | "USD";
  subtotal: number;
  iva: number;
  total: number;
  tasa_iva: number;
  tipo_cambio: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  expediente: string | null;
  referencia_bl: string | null;
  cliente_snapshot: Record<string, unknown> | null;
  organizacion_snapshot: Record<string, unknown> | null;
  conceptos: Array<Record<string, unknown>>;
}

export interface ProformaSnapshot {
  version: number;
  congelado_at: string;
  estado_al_congelar: string;
  numero: string;
  expediente: string | null;
  bl_master: string | null;
  tasa_iva_aplicada: number;
  subtotal_usd: number;
  iva_usd: number;
  total_usd: number;
  subtotal_mxn: number;
  iva_mxn: number;
  total_mxn: number;
  dias_credito: number | null;
  fecha_emision: string;
  operador: string | null;
  cliente_snapshot: Record<string, unknown> | null;
  organizacion_snapshot: Record<string, unknown> | null;
  conceptos: Array<Record<string, unknown>>;
}

function asObject<T>(value: Json | null): T | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as unknown as T;
}

export async function fetchFacturaSnapshot(facturaId: string): Promise<FacturaSnapshot | null> {
  const { data, error } = await supabase
    .from("facturas")
    .select("snapshot_emision")
    .eq("id", facturaId)
    .maybeSingle();
  if (error) throw error;
  return asObject<FacturaSnapshot>(data?.snapshot_emision ?? null);
}

export async function fetchProformaSnapshot(proformaId: string): Promise<ProformaSnapshot | null> {
  const { data, error } = await supabase
    .from("proformas")
    .select("snapshot_emision")
    .eq("id", proformaId)
    .maybeSingle();
  if (error) throw error;
  return asObject<ProformaSnapshot>(data?.snapshot_emision ?? null);
}
