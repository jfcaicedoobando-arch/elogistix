/**
 * Bloque R — Seguros de carga por embarque.
 * CRUD contra `public.seguros_embarque`. RLS aísla por organización.
 */
import { supabase } from "@/integrations/supabase/client";
import { run, unwrap, unwrapOr } from "@/lib/supabase/response";
import { registrarBitacoraEmbarque } from "./bitacoraEmbarques";
import type { Moneda } from "@/types/db";

export type MonedaSeguro = Moneda;

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
  const data = await unwrapOr(
    supabase
      .from("seguros_embarque")
      .select(COLUMNS)
      .eq("embarque_id", embarqueId)
      .is("deleted_at", null)
      .order("vigencia_desde", { ascending: false }),
    [],
  );
  // SAFE-CAST: COLUMNS lista explícita mapea 1:1 a SeguroEmbarque.
  return data as unknown as SeguroEmbarque[];
}

export async function createSeguroEmbarque(input: SeguroEmbarqueInput): Promise<SeguroEmbarque> {
  // organization_id se hereda del embarque si no se pasa.
  let orgId = input.organization_id;
  if (!orgId) {
    const emb = await unwrap(
      supabase
        .from("embarques")
        .select("organization_id")
        .eq("id", input.embarque_id)
        .maybeSingle(),
    );
    if (!emb?.organization_id) throw new Error("Embarque sin organización");
    orgId = emb.organization_id;
  }

  const data = await unwrap(
    supabase
      .from("seguros_embarque")
      .insert({ ...input, organization_id: orgId })
      .select(COLUMNS)
      .single(),
  );
  // SAFE-CAST: COLUMNS lista explícita mapea 1:1 a SeguroEmbarque.
  const seguro = data as unknown as SeguroEmbarque;
  await registrarBitacoraEmbarque({
    accion: "Creó seguro de embarque",
    entidadId: input.embarque_id,
    detalles: { seguroId: seguro.id, aseguradora: input.aseguradora, numeroPoliza: input.numero_poliza, sumaAseguradaUsd: input.suma_asegurada },
  });
  return seguro;
}

export async function updateSeguroEmbarque(
  id: string,
  patch: Partial<SeguroEmbarqueInput>,
): Promise<void> {
  await run(supabase.from("seguros_embarque").update(patch).eq("id", id));
  await registrarBitacoraEmbarque({
    accion: "Actualizó seguro de embarque",
    entidadId: patch.embarque_id,
    detalles: { seguroId: id, cambios: patch },
  });
}

export async function deleteSeguroEmbarque(id: string): Promise<void> {
  await run(
    supabase
      .from("seguros_embarque")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id),
  );
  await registrarBitacoraEmbarque({
    accion: "Eliminó seguro de embarque",
    detalles: { seguroId: id },
  });
}
