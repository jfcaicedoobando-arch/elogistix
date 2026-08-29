/**
 * Fetch + tipos para el reporte de compras — extraídos en v13.182.0 (Wave 2).
 */
import { supabase } from "@/integrations/supabase/client";
import { CAP_REPORTE } from "@/constants/queryCaps";

export interface FacturaLite {
  id: string;
  fecha_emision: string | null;
  /**
   * M-3 (re-fix v15): COSTO SIN IVA (subtotal). Presupuesto vs Real compara
   * subtotales, así que Compras debe hablar la misma moneda: antes sumaba el
   * total con IVA y las dos pantallas nunca cuadraban. Si una factura legacy
   * no tiene subtotal se usa el total como último recurso.
   */
  total: number;
  moneda: Moneda;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  tipo_cambio_usd: number | null;
}

export async function fetchFacturasReporte(
  desde: string,
  hasta: string,
  organizationId?: string | null,
): Promise<FacturaLite[]> {
  let q = supabase
    .from("proveedor_facturas")
    .select("id, fecha_emision, subtotal, total, moneda, proveedor_id, tipo_cambio_usd, proveedores(nombre)")
    .is("deleted_at", null)
    .neq("estado", "Cancelada")
    .gte("fecha_emision", desde)
    .lte("fecha_emision", hasta)
    .order("fecha_emision", { ascending: true })
    .limit(CAP_REPORTE);
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data, error } = await q;
  if (error) throw error;
  // SAFE-CAST: PostgREST devuelve `proveedores` como relación anidada.
  const raw = (data ?? []) as unknown as Array<{
    id: string; fecha_emision: string | null; subtotal: string | number | null; total: string | number;
    moneda: Moneda; proveedor_id: string | null;
    tipo_cambio_usd: number | null;
    proveedores: { nombre: string | null } | null;
  }>;
  return raw.map((r) => ({
    id: r.id,
    fecha_emision: r.fecha_emision,
    total: Number(r.subtotal ?? r.total ?? 0),
    moneda: r.moneda,
    proveedor_id: r.proveedor_id,
    proveedor_nombre: r.proveedores?.nombre ?? "Sin proveedor",
    tipo_cambio_usd: r.tipo_cambio_usd,
  }));
}
