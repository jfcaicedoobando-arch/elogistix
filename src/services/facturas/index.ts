/**
 * Servicio de facturas: queries del listado de facturas y operaciones sobre
 * conceptos de costo (gastos pendientes / marcar pagado).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { fromDb } from "@/lib/supabase/cast";

export type FacturaRow = Tables<"facturas">;

export { fetchFacturaSnapshot, fetchProformaSnapshot } from "./snapshots";
export type { FacturaSnapshot, ProformaSnapshot } from "./snapshots";

export type FacturaListItem = Pick<
  FacturaRow,
  | "id" | "numero" | "cliente_nombre" | "expediente" | "total" | "moneda"
  | "fecha_emision" | "fecha_vencimiento" | "estado"
  | "proforma_id" | "factura_pdf_url" | "factura_xml_url"
> & {
  proformas: { numero: string } | null;
};

const FACTURA_LIST_COLUMNS =
  "id, numero, cliente_nombre, expediente, total, moneda, fecha_emision, fecha_vencimiento, estado, proforma_id, factura_pdf_url, factura_xml_url, proformas:proforma_id(numero)" as const;

export async function fetchFacturas(organizationId: string | null): Promise<FacturaListItem[]> {
  let query = supabase
    .from("facturas")
    .select(FACTURA_LIST_COLUMNS)
    .order("created_at", { ascending: false });
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) throw error;
  return fromDb<FacturaListItem[]>(data ?? []);
}

export async function marcarCostoPagado(input: { id: string; referenciaPago?: string }): Promise<void> {
  const { error } = await supabase
    .from("conceptos_costo")
    .update({
      estado_liquidacion: "Pagado",
      fecha_pago: new Date().toISOString().split("T")[0],
      referencia_pago: input.referenciaPago || null,
    })
    .eq("id", input.id);
  if (error) throw error;
}

export async function fetchGastosPendientes() {
  const { data, error } = await supabase
    .from("conceptos_costo")
    .select("*, embarques!conceptos_costo_embarque_id_fkey(expediente)")
    .eq("estado_liquidacion", "Pendiente")
    .order("fecha_vencimiento", { ascending: true });
  if (error) throw error;
  return data;
}
