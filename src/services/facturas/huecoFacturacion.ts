/**
 * Servicio: trae el "Hueco de Facturación" — embarques en los que ya pasaron
 * más de 5 días desde ETD pero todavía NO existe una factura con PDF adjunto
 * para su expediente.
 *
 * Es una vista global (no depende del mes seleccionado en Proyección).
 */
import { supabase } from "@/integrations/supabase/client";
import { sumarConceptosEnMxn, sumarConceptosEnUsd } from "@/lib/domain/proyeccionFacturacion";

export interface FilaHueco {
  embarque_id: string;
  expediente: string;
  cliente_nombre: string;
  operador: string;
  etd: string;
  eta: string | null;
  diasDesdeEtd: number;
  ventaUsd: number;
  ventaMxn: number;
}

export interface HuecoFacturacionData {
  filas: FilaHueco[];
  totalEmbarques: number;
  totalUsd: number;
  totalMxn: number;
}

const DIAS_HUECO = 5;

export async function fetchHuecoFacturacion(
  organizationId: string | null,
): Promise<HuecoFacturacionData> {
  // Fecha tope: ETD <= hoy - 5 días → "ya pasaron más de 5 días desde ETD"
  const hoy = new Date();
  const tope = new Date(hoy.getTime() - DIAS_HUECO * 24 * 60 * 60 * 1000);
  const topeStr = tope.toISOString().slice(0, 10);

  let q = supabase
    .from("embarques")
    .select(
      "id, expediente, cliente_nombre, operador, etd, eta, tipo_cambio_usd, tipo_cambio_eur",
    )
    .not("etd", "is", null)
    .lte("etd", topeStr)
    .order("etd", { ascending: true });
  if (organizationId) q = q.eq("organization_id", organizationId);

  const { data: embarques, error } = await q;
  if (error) throw error;
  const embarquesArr = embarques ?? [];
  if (embarquesArr.length === 0) {
    return { filas: [], totalEmbarques: 0, totalUsd: 0, totalMxn: 0 };
  }

  const ids = embarquesArr.map((e) => e.id);
  const expedientes = Array.from(
    new Set(embarquesArr.map((e) => e.expediente).filter((x): x is string => !!x)),
  );

  const [ventasRes, facturasRes] = await Promise.all([
    supabase
      .from("conceptos_venta")
      .select("embarque_id, total, moneda")
      .in("embarque_id", ids),
    expedientes.length > 0
      ? supabase
          .from("facturas")
          .select("expediente, factura_pdf_url")
          .in("expediente", expedientes)
          .not("factura_pdf_url", "is", null)
      : Promise.resolve({ data: [], error: null } as {
          data: { expediente: string | null; factura_pdf_url: string | null }[];
          error: null;
        }),
  ]);
  if (ventasRes.error) throw ventasRes.error;
  if (facturasRes.error) throw facturasRes.error;

  const ventasMap = new Map<string, { monto: number; moneda: string }[]>();
  for (const v of ventasRes.data ?? []) {
    const arr = ventasMap.get(v.embarque_id) ?? [];
    arr.push({ monto: Number(v.total ?? 0), moneda: String(v.moneda ?? "MXN") });
    ventasMap.set(v.embarque_id, arr);
  }
  const facturadosSet = new Set<string>(
    (facturasRes.data ?? []).map((f) => f.expediente).filter((x): x is string => !!x),
  );

  const hoyMs = hoy.getTime();
  const filas: FilaHueco[] = [];
  let totalUsd = 0;
  let totalMxn = 0;

  for (const e of embarquesArr) {
    // Excluir embarques ya facturados (su expediente tiene factura con PDF).
    if (e.expediente && facturadosSet.has(e.expediente)) continue;
    const tcUsd = Number(e.tipo_cambio_usd ?? 1);
    const tcEur = Number(e.tipo_cambio_eur ?? 1);
    const ventas = ventasMap.get(e.id) ?? [];
    const ventaUsd = sumarConceptosEnUsd(ventas, tcUsd, tcEur);
    const ventaMxn = sumarConceptosEnMxn(ventas, tcUsd, tcEur);

    const etdMs = e.etd ? new Date(e.etd).getTime() : 0;
    const diasDesdeEtd = etdMs > 0 ? Math.floor((hoyMs - etdMs) / (24 * 60 * 60 * 1000)) : 0;

    filas.push({
      embarque_id: e.id,
      expediente: e.expediente ?? "—",
      cliente_nombre: e.cliente_nombre ?? "",
      operador: e.operador ?? "",
      etd: e.etd ?? "",
      eta: e.eta,
      diasDesdeEtd,
      ventaUsd,
      ventaMxn,
    });
    totalUsd += ventaUsd;
    totalMxn += ventaMxn;
  }

  // Más urgentes primero (mayor número de días desde ETD).
  filas.sort((a, b) => b.diasDesdeEtd - a.diasDesdeEtd);

  return {
    filas,
    totalEmbarques: filas.length,
    totalUsd,
    totalMxn,
  };
}
