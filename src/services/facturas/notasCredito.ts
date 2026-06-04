/**
 * Notas de crédito internas (CxC – Sprint 1).
 *
 * Flujo de estado: Borrador → Aprobada → Aplicada (resta saldo a la factura).
 * También puede ir a Cancelada desde Borrador o Aprobada.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { getCurrentUser } from "@/services/auth";

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
  const user = await getCurrentUser();
  const payload: TablesInsert<"factura_notas_credito"> = {
    ...input,
    created_by: user.id,
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
  const patch: Partial<NotaCredito> = { estado: estadoNuevo };
  if (estadoNuevo === "Aprobada") {
    const user = await getCurrentUser();
    patch.aprobada_por = user.id;
    patch.aprobada_at = new Date().toISOString();
  }
  const { error } = await supabase.from("factura_notas_credito").update(patch).eq("id", id);
  if (error) throw error;
}

export async function eliminarNotaCredito(id: string): Promise<void> {
  const user = await getCurrentUser();
  const { error } = await supabase
    .from("factura_notas_credito")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", id)
    .eq("estado", "Borrador"); // sólo borradores se eliminan
  if (error) throw error;
}
