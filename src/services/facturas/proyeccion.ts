/**
 * Servicio: trae todos los datos necesarios para construir la proyección de
 * facturación de un mes (embarques con ETA en el mes + sus conceptos de venta,
 * conceptos de costo y existencia de factura con PDF).
 */
import { supabase } from "@/integrations/supabase/client";
import {
  rangoMes,
  sumarConceptosEnMxn,
  type FilaProyeccion,
} from "@/lib/domain/proyeccionFacturacion";

export interface ProyeccionMesParams {
  organizationId: string | null;
  year: number;
  month: number;
}

export async function fetchProyeccionMes({
  organizationId,
  year,
  month,
}: ProyeccionMesParams): Promise<FilaProyeccion[]> {
  const { desde, hasta } = rangoMes(year, month);

  // 1) Embarques cuya ETA cae en el rango del mes.
  let q = supabase
    .from("embarques")
    .select(
      "id, expediente, cliente_nombre, operador, eta, contenedor, tipo_cambio_usd, tipo_cambio_eur, tiene_proforma",
    )
    .gte("eta", desde)
    .lte("eta", hasta)
    .order("eta", { ascending: true });

  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data: embarques, error } = await q;
  if (error) throw error;
  const embarquesArr = embarques ?? [];
  if (embarquesArr.length === 0) return [];

  const ids = embarquesArr.map((e) => e.id);

  // 2-4) En paralelo: conceptos_venta, conceptos_costo, facturas con PDF.
  const [ventasRes, costosRes, facturasRes] = await Promise.all([
    supabase
      .from("conceptos_venta")
      .select("embarque_id, total, moneda")
      .in("embarque_id", ids),
    supabase
      .from("conceptos_costo")
      .select("embarque_id, monto, moneda")
      .in("embarque_id", ids),
    supabase
      .from("facturas")
      .select("embarque_id, factura_pdf_url")
      .in("embarque_id", ids)
      .not("factura_pdf_url", "is", null),
  ]);
  if (ventasRes.error) throw ventasRes.error;
  if (costosRes.error) throw costosRes.error;
  if (facturasRes.error) throw facturasRes.error;

  // Indexar por embarque_id.
  const ventasMap = new Map<string, { monto: number; moneda: string }[]>();
  for (const v of ventasRes.data ?? []) {
    const arr = ventasMap.get(v.embarque_id) ?? [];
    arr.push({ monto: Number(v.total ?? 0), moneda: String(v.moneda ?? "MXN") });
    ventasMap.set(v.embarque_id, arr);
  }
  const costosMap = new Map<string, { monto: number; moneda: string }[]>();
  for (const c of costosRes.data ?? []) {
    const arr = costosMap.get(c.embarque_id) ?? [];
    arr.push({ monto: Number(c.monto ?? 0), moneda: String(c.moneda ?? "MXN") });
    costosMap.set(c.embarque_id, arr);
  }
  const facturadosSet = new Set<string>(
    (facturasRes.data ?? []).map((f) => f.embarque_id).filter(Boolean) as string[],
  );

  // Construir filas planas.
  return embarquesArr.map<FilaProyeccion>((e) => {
    const tcUsd = Number(e.tipo_cambio_usd ?? 1);
    const tcEur = Number(e.tipo_cambio_eur ?? 1);
    const ventas = ventasMap.get(e.id) ?? [];
    const costos = costosMap.get(e.id) ?? [];
    return {
      embarque_id: e.id,
      expediente: e.expediente ?? "",
      cliente_nombre: e.cliente_nombre ?? "",
      operador: e.operador ?? "",
      eta: e.eta,
      contenedor: e.contenedor,
      tipo_cambio_usd: tcUsd,
      tipo_cambio_eur: tcEur,
      tiene_proforma: !!e.tiene_proforma,
      tiene_factura_pdf: facturadosSet.has(e.id),
      venta_mxn: sumarConceptosEnMxn(ventas, tcUsd, tcEur),
      costo_mxn: sumarConceptosEnMxn(costos, tcUsd, tcEur),
    };
  });
}
