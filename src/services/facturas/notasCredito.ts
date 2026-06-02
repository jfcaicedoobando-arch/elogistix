/**
 * Notas de crédito internas (CxC – Sprint 1).
 *
 * Flujo de estado: Borrador → Aprobada → Aplicada (resta saldo a la factura).
 * También puede ir a Cancelada desde Borrador o Aprobada.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type NotaCredito = Tables<"factura_notas_credito">;
export type EstadoNotaCredito = NotaCredito["estado"];

export interface CrearNotaCreditoInput {
  factura_id: string;
  folio: string;
  motivo: NotaCredito["motivo"];
  descripcion: string;
  monto: number;
  moneda: NotaCredito["moneda"];
  tipo_cambio: number;
  fecha_emision: string;
}

export async function listarNotasCreditoPorFactura(facturaId: string): Promise<NotaCredito[]> {
  const { data, error } = await supabase
    .from("factura_notas_credito")
    .select("*")
    .eq("factura_id", facturaId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function crearNotaCredito(input: CrearNotaCreditoInput): Promise<NotaCredito> {
  const { data: userData } = await supabase.auth.getUser();
  const payload: TablesInsert<"factura_notas_credito"> = {
    ...input,
    created_by: userData.user?.id ?? null,
    estado: "Borrador",
  };
  const { data, error } = await supabase
    .from("factura_notas_credito")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

function asegurarTransicion(actual: EstadoNotaCredito, siguiente: EstadoNotaCredito): void {
  const validas: Record<EstadoNotaCredito, EstadoNotaCredito[]> = {
    Borrador: ["Aprobada", "Cancelada"],
    Aprobada: ["Aplicada", "Cancelada"],
    Aplicada: [],
    Cancelada: [],
  };
  if (!validas[actual].includes(siguiente)) {
    throw new Error(`Transición inválida: ${actual} → ${siguiente}`);
  }
}

export async function cambiarEstadoNotaCredito(
  id: string,
  estadoActual: EstadoNotaCredito,
  estadoNuevo: EstadoNotaCredito,
): Promise<void> {
  asegurarTransicion(estadoActual, estadoNuevo);
  const { data: userData } = await supabase.auth.getUser();
  const patch: Partial<NotaCredito> = { estado: estadoNuevo };
  if (estadoNuevo === "Aprobada") {
    patch.aprobada_por = userData.user?.id ?? null;
    patch.aprobada_at = new Date().toISOString();
  }
  const { error } = await supabase.from("factura_notas_credito").update(patch).eq("id", id);
  if (error) throw error;
}

export async function eliminarNotaCredito(id: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("factura_notas_credito")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userData.user?.id ?? null })
    .eq("id", id)
    .eq("estado", "Borrador"); // sólo borradores se eliminan
  if (error) throw error;
}
