/**
 * Fuentes de datos (Supabase) para el "Hueco de Facturación". Solo I/O.
 */
import { supabase } from "@/integrations/supabase/client";

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
  const [ventasRes, facturasRes] = await Promise.all([
    supabase.from("conceptos_venta").select("embarque_id, total, moneda").in("embarque_id", ids),
    expedientes.length > 0
      ? supabase
          .from("facturas")
          .select("expediente, factura_pdf_url")
          .in("expediente", expedientes)
          .not("factura_pdf_url", "is", null)
      : Promise.resolve({
          data: [] as { expediente: string | null; factura_pdf_url: string | null }[],
          error: null,
        }),
  ]);
  if (ventasRes.error) throw ventasRes.error;
  if (facturasRes.error) throw facturasRes.error;
  return { ventas: ventasRes.data ?? [], facturas: facturasRes.data ?? [] };
}
