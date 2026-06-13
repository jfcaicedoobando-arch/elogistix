/**
 * Fuentes de datos (Supabase) para el "Hueco de Facturación". Solo I/O.
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchFacturasPorExpedientes } from "@/features/facturas/services/shared/fetchFacturas";

export interface EmbarqueHuecoRow {
  id: string;
  expediente: string | null;
  cliente_nombre: string | null;
  operador: string | null;
  etd: string | null;
  eta: string | null;
  bl_master: string | null;
  bl_house: string | null;
  tipo_cambio_usd: number | null;
  tipo_cambio_eur: number | null;
}

export async function fetchEmbarquesParaHueco(
  organizationId: string | null,
  limiteIso: string,
): Promise<EmbarqueHuecoRow[]> {
  let q = supabase
    .from("embarques")
    .select(
      "id, expediente, cliente_nombre, operador, etd, eta, bl_master, bl_house, tipo_cambio_usd, tipo_cambio_eur",
    )
    .not("etd", "is", null)
    .lte("etd", limiteIso)
    .order("etd", { ascending: true });
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchVentasYFacturas(ids: string[], expedientes: string[]) {
  const [ventasRes, facturas] = await Promise.all([
    supabase.from("conceptos_venta").select("embarque_id, total, moneda").in("embarque_id", ids),
    fetchFacturasPorExpedientes(expedientes),
  ]);
  if (ventasRes.error) throw ventasRes.error;
  return { ventas: ventasRes.data ?? [], facturas };
}
