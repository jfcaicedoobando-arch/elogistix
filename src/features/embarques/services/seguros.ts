/**
 * Bloque R — Seguros de carga por embarque.
 * CRUD contra `public.seguros_embarque`. RLS aísla por organización.
 */
import { supabase } from "@/integrations/supabase/client";

export type MonedaSeguro = "MXN" | "USD" | "EUR";

export interface SeguroEmbarque {
  id: string;
  embarque_id: string;
  organization_id: string;
  aseguradora: string;
  numero_poliza: string;
  certificado_url: string | null;
  cobertura_descripcion: string | null;
  suma_asegurada: number;
  deducible: number;
  prima: number;
  moneda: MonedaSeguro;
  vigencia_desde: string;
  vigencia_hasta: string;
  contacto: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export type SeguroEmbarqueInput = Omit<
  SeguroEmbarque,
  "id" | "created_at" | "updated_at" | "organization_id"
> & { organization_id?: string };

const COLUMNS =
  "id, embarque_id, organization_id, aseguradora, numero_poliza, certificado_url, cobertura_descripcion, suma_asegurada, deducible, prima, moneda, vigencia_desde, vigencia_hasta, contacto, notas, created_at, updated_at";

export async function fetchSegurosEmbarque(embarqueId: string): Promise<SeguroEmbarque[]> {
  const { data, error } = await supabase
    .from("seguros_embarque")
    .select(COLUMNS)
    .eq("embarque_id", embarqueId)
    .order("vigencia_desde", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SeguroEmbarque[];
}

export async function createSeguroEmbarque(input: SeguroEmbarqueInput): Promise<SeguroEmbarque> {
  // organization_id se hereda del embarque si no se pasa.
  let orgId = input.organization_id;
  if (!orgId) {
    const { data: emb, error: embErr } = await supabase
      .from("embarques")
      .select("organization_id")
      .eq("id", input.embarque_id)
      .maybeSingle();
    if (embErr) throw embErr;
    if (!emb?.organization_id) throw new Error("Embarque sin organización");
    orgId = emb.organization_id;
  }

  const { data, error } = await supabase
    .from("seguros_embarque")
    .insert({ ...input, organization_id: orgId })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as SeguroEmbarque;
}

export async function updateSeguroEmbarque(
  id: string,
  patch: Partial<SeguroEmbarqueInput>,
): Promise<void> {
  const { error } = await supabase.from("seguros_embarque").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteSeguroEmbarque(id: string): Promise<void> {
  const { error } = await supabase
    .from("seguros_embarque")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
