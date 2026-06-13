/**
 * Service de pagos a proveedor (CxP).
 * Incluye lógica de diferencia cambiaria cuando la factura es USD y el pago en MXN.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type PagoProveedor = Tables<"pagos_proveedor">;

export async function listarPagosProveedor(facturaId: string): Promise<PagoProveedor[]> {
  const { data, error } = await supabase
    .from("pagos_proveedor")
    .select("*")
    .eq("proveedor_factura_id", facturaId)
    .order("fecha_pago", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PagoProveedor[];
}

export interface RegistrarPagoProveedorInput {
  proveedor_factura_id: string;
  fecha_pago: string;
  monto: number;
  moneda: PagoProveedor["moneda"];
  tipo_cambio_usd: number;
  metodo_pago: string;
  referencia?: string;
  cuenta_bancaria_id?: string | null;
  notas?: string;
  /** Si la factura es USD y se paga en MXN, esta es la diferencia respecto al TC original. */
  diferencia_cambiaria_mxn?: number | null;
}

export async function registrarPagoProveedor(
  input: RegistrarPagoProveedorInput,
  userId: string | null,
): Promise<PagoProveedor> {
  const payload: TablesInsert<"pagos_proveedor"> = {
    proveedor_factura_id: input.proveedor_factura_id,
    fecha_pago: input.fecha_pago,
    monto: input.monto,
    moneda: input.moneda,
    tipo_cambio_usd: input.tipo_cambio_usd,
    metodo_pago: input.metodo_pago,
    referencia: input.referencia ?? "",
    cuenta_bancaria_id: input.cuenta_bancaria_id ?? null,
    notas: input.notas ?? "",
    diferencia_cambiaria_mxn: input.diferencia_cambiaria_mxn ?? null,
    created_by: userId,
  };
  const { data, error } = await supabase
    .from("pagos_proveedor")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;

  // Recalcular estado de la factura origen
  await recalcularEstadoFactura(input.proveedor_factura_id);
  return data as PagoProveedor;
}

export async function eliminarPagoProveedor(id: string, facturaId: string, userId: string | null) {
  const { error } = await supabase
    .from("pagos_proveedor")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id);
  if (error) throw error;
  await recalcularEstadoFactura(facturaId);
}

/**
 * Recalcula el estado de la factura (Vigente/Pagada) en función de su saldo
 * según `v_proveedor_facturas_saldo`. No reabre facturas Canceladas/Borrador.
 */
async function recalcularEstadoFactura(facturaId: string) {
  const { data: saldoRow, error: e1 } = await supabase
    .from("v_proveedor_facturas_saldo")
    .select("saldo")
    .eq("proveedor_factura_id", facturaId)
    .maybeSingle();
  if (e1) throw e1;
  const { data: fact, error: e2 } = await supabase
    .from("proveedor_facturas")
    .select("estado")
    .eq("id", facturaId)
    .maybeSingle();
  if (e2) throw e2;
  if (!fact) return;
  if (fact.estado === "Cancelada" || fact.estado === "Borrador") return;
  const saldo = Number(saldoRow?.saldo ?? 0);
  const nuevoEstado: "Pagada" | "Vigente" = saldo <= 0.01 ? "Pagada" : "Vigente";
  if (nuevoEstado !== fact.estado) {
    await supabase.from("proveedor_facturas").update({ estado: nuevoEstado }).eq("id", facturaId);
  }
}
