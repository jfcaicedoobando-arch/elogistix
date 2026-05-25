/**
 * Fuentes de datos (Supabase) para la proyección de facturación.
 * Solo I/O: trae embarques del mes + sus conceptos/facturas. Sin agregaciones.
 */
import { supabase } from "@/integrations/supabase/client";

export interface EmbarqueProyeccionRow {
  id: string;
  expediente: string | null;
  cliente_nombre: string | null;
  operador: string | null;
  eta: string | null;
  contenedor: string | null;
  tipo_cambio_usd: number | null;
  tipo_cambio_eur: number | null;
  tiene_proforma: boolean | null;
}

export async function fetchEmbarquesMes(
  organizationId: string | null,
  desde: string,
  hasta: string,
): Promise<EmbarqueProyeccionRow[]> {
  let q = supabase
    .from("embarques")
    .select(
      "id, expediente, cliente_nombre, operador, eta, contenedor, tipo_cambio_usd, tipo_cambio_eur, tiene_proforma",
    )
    .gte("eta", desde)
    .lte("eta", hasta)
    .order("eta", { ascending: true });
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchConceptosYFacturas(ids: string[], expedientes: string[]) {
  const [ventasRes, costosRes, facturasRes] = await Promise.all([
    supabase.from("conceptos_venta").select("embarque_id, total, moneda").in("embarque_id", ids),
    supabase.from("conceptos_costo").select("embarque_id, monto, moneda").in("embarque_id", ids),
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
  if (costosRes.error) throw costosRes.error;
  if (facturasRes.error) throw facturasRes.error;
  return {
    ventas: ventasRes.data ?? [],
    costos: costosRes.data ?? [],
    facturas: facturasRes.data ?? [],
  };
}
