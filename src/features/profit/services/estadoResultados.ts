/**
 * Fuente de datos del Estado de Resultados mensual.
 * Filtra embarques por ETA dentro del mes (excluye Cancelado) y trae
 * todos los conceptos_venta / conceptos_costo asociados.
 */
import { supabase } from "@/integrations/supabase/client";
import { rangoMes } from "@/features/facturacion/domain/proyeccionFacturacion";
import {
  buildEstadoResultados,
  type EstadoResultados,
  type EmbarqueER,
  type ConceptoVentaER,
  type ConceptoCostoER,
} from "@/features/profit/domain/estadoResultados";

interface Params {
  organizationId: string | null;
  year: number;
  month: number;
}

export async function fetchEstadoResultadosMes(p: Params): Promise<EstadoResultados> {
  const { desde, hasta } = rangoMes(p.year, p.month);
  let q = supabase
    .from("embarques")
    .select("id, modo, tipo_cambio_usd, tipo_cambio_eur, estado")
    .gte("eta", desde)
    .lte("eta", hasta)
    .neq("estado", "Cancelado")
    .is("deleted_at", null);
  if (p.organizationId) q = q.eq("organization_id", p.organizationId);
  const { data: embarques, error: errEmb } = await q;
  if (errEmb) throw errEmb;

  const ids = (embarques ?? []).map((e) => e.id);
  if (ids.length === 0) {
    return buildEstadoResultados([], [], []);
  }

  const [ventasRes, costosRes] = await Promise.all([
    supabase
      .from("conceptos_venta")
      .select("embarque_id, descripcion, total, moneda")
      .in("embarque_id", ids)
      .is("deleted_at", null),
    supabase
      .from("conceptos_costo")
      .select("embarque_id, concepto, monto, moneda")
      .in("embarque_id", ids)
      .is("deleted_at", null),
  ]);
  if (ventasRes.error) throw ventasRes.error;
  if (costosRes.error) throw costosRes.error;

  const embER: EmbarqueER[] = (embarques ?? []).map((e) => ({
    id: e.id,
    modo: e.modo,
    tipo_cambio_usd: e.tipo_cambio_usd,
    tipo_cambio_eur: e.tipo_cambio_eur,
  }));
  const ventas: ConceptoVentaER[] = (ventasRes.data ?? []) as ConceptoVentaER[];
  const costos: ConceptoCostoER[] = (costosRes.data ?? []) as ConceptoCostoER[];

  return buildEstadoResultados(embER, ventas, costos);
}
