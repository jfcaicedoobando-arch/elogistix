/**
 * Fetch + tipos para el reporte de compras — extraídos en v13.182.0 (Wave 2).
 */
import { supabase } from "@/integrations/supabase/client";
import { CAP_REPORTE } from "@/constants/queryCaps";

export interface FacturaLite {
  id: string;
  fecha_emision: string | null;
  total: number;
  moneda: "MXN" | "USD" | "EUR";
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  tipo_cambio_usd: number | null;
}

export async function fetchFacturasReporte(desde: string, hasta: string): Promise<FacturaLite[]> {
  const { data, error } = await supabase
    .from("proveedor_facturas")
    .select("id, fecha_emision, total, moneda, proveedor_id, tipo_cambio_usd, proveedores(nombre)")
    .is("deleted_at", null)
    .neq("estado", "Cancelada")
    .gte("fecha_emision", desde)
    .lte("fecha_emision", hasta)
    .order("fecha_emision", { ascending: true })
    .limit(CAP_REPORTE);
  if (error) throw error;
  // SAFE-CAST: PostgREST devuelve `proveedores` como relación anidada.
  const raw = (data ?? []) as unknown as Array<{
    id: string; fecha_emision: string | null; total: string | number;
    moneda: "MXN" | "USD" | "EUR"; proveedor_id: string | null;
    tipo_cambio_usd: number | null;
    proveedores: { nombre: string | null } | null;
  }>;
  return raw.map((r) => ({
    id: r.id,
    fecha_emision: r.fecha_emision,
    total: Number(r.total ?? 0),
    moneda: r.moneda,
    proveedor_id: r.proveedor_id,
    proveedor_nombre: r.proveedores?.nombre ?? "Sin proveedor",
    tipo_cambio_usd: r.tipo_cambio_usd,
  }));
}
