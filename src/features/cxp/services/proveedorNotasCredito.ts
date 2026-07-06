/**
 * Notas de crédito de proveedor — CRUD y aplicación contra facturas.
 * Una NC en estado `Aplicada` reduce el saldo de la factura.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { registrarActividad } from "@/lib/domain/bitacora/registrar";

export type NotaCreditoProveedor = Tables<"proveedor_notas_credito">;

export async function fetchNotasCreditoFactura(
  facturaId: string,
): Promise<NotaCreditoProveedor[]> {
  const { data, error } = await supabase
    .from("proveedor_notas_credito")
    .select("*")
    .eq("proveedor_factura_id", facturaId)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function crearNotaCreditoProveedor(
  payload: TablesInsert<"proveedor_notas_credito">,
): Promise<NotaCreditoProveedor> {
  const { data, error } = await supabase
    .from("proveedor_notas_credito")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  await registrarActividad({
    modulo: "cxp",
    accion: "crear_nota_credito",
    entidadId: data.proveedor_factura_id,
    entidadNombre: data.folio_nc ?? "",
    detalles: { nc_id: data.id, monto: data.monto, moneda: data.moneda },
  });
  return data;
}

export async function aplicarNotaCredito(id: string): Promise<void> {
  const { error } = await supabase
    .from("proveedor_notas_credito")
    .update({ estado: "Aplicada" })
    .eq("id", id);
  if (error) throw error;
  await registrarActividad({
    modulo: "cxp",
    accion: "aplicar_nota_credito",
    entidadId: id,
  });
}

export async function cancelarNotaCredito(id: string): Promise<void> {
  const { error } = await supabase
    .from("proveedor_notas_credito")
    .update({ estado: "Cancelada" })
    .eq("id", id);
  if (error) throw error;
  await registrarActividad({
    modulo: "cxp",
    accion: "cancelar_nota_credito",
    entidadId: id,
  });
}
