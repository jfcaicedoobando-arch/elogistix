/**
 * Servicio: trae todos los datos necesarios para construir la proyección de
 * facturación de un mes (embarques con ETA en el mes + sus conceptos de venta,
 * conceptos de costo y existencia de factura con PDF).
 */
import { supabase } from "@/integrations/supabase/client";
import {
  rangoMes,
  sumarConceptosEnMxn,
  sumarConceptosEnUsd,
  type FilaProyeccion,
} from "@/lib/domain/proyeccionFacturacion";

export interface ProyeccionMesParams {
  organizationId: string | null;
  year: number;
  month: number;
}

interface ConceptoAgg { monto: number; moneda: string }

async function fetchEmbarquesMes(organizationId: string | null, desde: string, hasta: string) {
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

async function fetchConceptosYFacturas(ids: string[], expedientes: string[]) {
  const [ventasRes, costosRes, facturasRes] = await Promise.all([
    supabase.from("conceptos_venta").select("embarque_id, total, moneda").in("embarque_id", ids),
    supabase.from("conceptos_costo").select("embarque_id, monto, moneda").in("embarque_id", ids),
    expedientes.length > 0
      ? supabase
          .from("facturas")
          .select("expediente, factura_pdf_url")
          .in("expediente", expedientes)
          .not("factura_pdf_url", "is", null)
      : Promise.resolve({ data: [] as { expediente: string | null; factura_pdf_url: string | null }[], error: null }),
  ]);
  if (ventasRes.error) throw ventasRes.error;
  if (costosRes.error) throw costosRes.error;
  if (facturasRes.error) throw facturasRes.error;
  return { ventas: ventasRes.data ?? [], costos: costosRes.data ?? [], facturas: facturasRes.data ?? [] };
}

function indexarPorEmbarque(
  rows: { embarque_id: string; total?: number | null; monto?: number | null; moneda: string | null }[],
  key: "total" | "monto",
): Map<string, ConceptoAgg[]> {
  const map = new Map<string, ConceptoAgg[]>();
  for (const r of rows) {
    const arr = map.get(r.embarque_id) ?? [];
    arr.push({ monto: Number(r[key] ?? 0), moneda: String(r.moneda ?? "MXN") });
    map.set(r.embarque_id, arr);
  }
  return map;
}

export async function fetchProyeccionMes({
  organizationId,
  year,
  month,
}: ProyeccionMesParams): Promise<FilaProyeccion[]> {
  const { desde, hasta } = rangoMes(year, month);
  const embarquesArr = await fetchEmbarquesMes(organizationId, desde, hasta);
  if (embarquesArr.length === 0) return [];

  const ids = embarquesArr.map((e) => e.id);
  const expedientesUnicos = Array.from(
    new Set(embarquesArr.map((e) => e.expediente).filter((x): x is string => !!x)),
  );

  const { ventas, costos, facturas } = await fetchConceptosYFacturas(ids, expedientesUnicos);
  const ventasMap = indexarPorEmbarque(ventas, "total");
  const costosMap = indexarPorEmbarque(costos, "monto");
  const facturadosSet = new Set<string>(
    facturas.map((f) => f.expediente).filter((x): x is string => !!x),
  );

  return embarquesArr.map<FilaProyeccion>((e) => {
    const tcUsd = Number(e.tipo_cambio_usd ?? 1);
    const tcEur = Number(e.tipo_cambio_eur ?? 1);
    const v = ventasMap.get(e.id) ?? [];
    const c = costosMap.get(e.id) ?? [];
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
      tiene_factura_pdf: !!e.expediente && facturadosSet.has(e.expediente),
      venta_mxn: sumarConceptosEnMxn(v, tcUsd, tcEur),
      venta_usd: sumarConceptosEnUsd(v, tcUsd, tcEur),
      costo_mxn: sumarConceptosEnMxn(c, tcUsd, tcEur),
      costo_usd: sumarConceptosEnUsd(c, tcUsd, tcEur),
    };
  });
}
