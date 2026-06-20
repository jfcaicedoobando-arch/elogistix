/**
 * Notas de crédito internas (CxC – Sprint 1).
 *
 * Flujo de estado: Borrador → Aprobada → Aplicada (resta saldo a la factura).
 * También puede ir a Cancelada desde Borrador o Aprobada.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { getCurrentUser } from "@/features/auth/services";

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

export interface NotaCreditoConFactura extends NotaCredito {
  factura_numero: string;
  cliente_id: string;
  cliente_nombre: string;
}

export interface ListarNotasCreditoRecientesFiltros {
  cliente_id?: string;
  estado?: EstadoNotaCredito | "todos";
  limit?: number;
}

/**
 * Lista las notas de crédito más recientes en toda la cartera, con datos
 * básicos de la factura asociada. Usado por la vista consolidada de NCs
 * dentro de Cobranza (G de la auditoría 13.49.0).
 */
export async function listarNotasCreditoRecientes(
  filtros: ListarNotasCreditoRecientesFiltros = {},
): Promise<NotaCreditoConFactura[]> {
  const limit = filtros.limit ?? 100;
  let query = supabase
    .from("factura_notas_credito")
    .select(`
      *,
      facturas!inner(numero, cliente_id, cliente_nombre)
    `)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (filtros.cliente_id) query = query.eq("facturas.cliente_id", filtros.cliente_id);
  if (filtros.estado && filtros.estado !== "todos") query = query.eq("estado", filtros.estado);

  const { data, error } = await query;
  if (error) throw error;
  // SAFE-CAST: el join embebido `facturas!inner` viene como objeto anidado.
  type RawRow = NotaCredito & { facturas: { numero: string; cliente_id: string; cliente_nombre: string } | null };
  return ((data as unknown as RawRow[] | null) ?? []).map((row) => { // SAFE-CAST: join embebido validado arriba

    const { facturas, ...nota } = row;
    return {
      ...nota,
      factura_numero: facturas?.numero ?? "—",
      cliente_id: facturas?.cliente_id ?? "",
      cliente_nombre: facturas?.cliente_nombre ?? "—",
    };
  });
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
