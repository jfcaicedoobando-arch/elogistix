/**
 * Queries de conceptos venta/costo asociados a un embarque.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type ConceptoVentaRow = Tables<"conceptos_venta">;
type ConceptoCostoRow = Tables<"conceptos_costo">;

export async function fetchEmbarqueConceptosVenta(embarqueId: string): Promise<ConceptoVentaRow[]> {
  const { data, error } = await supabase
    .from("conceptos_venta")
    .select(
      "id, embarque_id, descripcion, cantidad, precio_unitario, total, moneda, organization_id, created_at, estado_facturacion, proforma_id, aplica_iva",
    )
    .eq("embarque_id", embarqueId);
  if (error) throw error;
  return (data ?? []) as ConceptoVentaRow[];
}

export async function fetchEmbarqueConceptosCosto(embarqueId: string): Promise<ConceptoCostoRow[]> {
  const { data, error } = await supabase
    .from("conceptos_costo")
    .select(
      "id, embarque_id, concepto, monto, moneda, proveedor_id, proveedor_nombre, estado_liquidacion, fecha_pago, fecha_vencimiento, referencia_pago, organization_id, created_at",
    )
    .eq("embarque_id", embarqueId);
  if (error) throw error;
  return (data ?? []) as ConceptoCostoRow[];
}
