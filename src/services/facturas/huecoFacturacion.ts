/**
 * Servicio: "Hueco de Facturación".
 *
 * Un embarque está en "hueco" si:
 *   - ETD >= 2026-04-01 (fecha de inicio del modelo nuevo)
 *   - (hoy - ETD) > 5 días (ya nos facturó el proveedor)
 *   - Y NO tiene factura con factura_pdf_url asociada por expediente.
 *
 * No filtra por mes — es un indicador global y persistente.
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
  bl_master: string | null;
  bl_house: string | null;
  diasDesdeEtd: number;
  ventaMxn: number;
  ventaUsd: number;
}

export interface HuecoFacturacionResult {
  filas: FilaHueco[];
  totalEmbarques: number;
  totalUsd: number;
  totalMxn: number;
}

const FECHA_INICIO_HUECO = "2026-04-01";
const DIAS_UMBRAL = 5;

function diasDesde(fechaIso: string, hoy = new Date()): number {
  const d = new Date(fechaIso + "T00:00:00");
  const ms = hoy.getTime() - d.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export async function fetchHuecoFacturacion({
  organizationId,
  hoy = new Date(),
}: {
  organizationId: string | null;
  hoy?: Date;
}): Promise<HuecoFacturacionResult> {
  // Fecha máxima de ETD que aún cuenta como "hueco": hoy - 5 días.
  const limite = new Date(hoy);
  limite.setDate(limite.getDate() - DIAS_UMBRAL - 1); // > 5 días => etd <= hoy - 6
  const limiteIso = limite.toISOString().slice(0, 10);

  let q = supabase
    .from("embarques")
    .select(
      "id, expediente, cliente_nombre, operador, etd, eta, tipo_cambio_usd, tipo_cambio_eur",
    )
    .gte("etd", FECHA_INICIO_HUECO)
    .lte("etd", limiteIso)
    .order("etd", { ascending: true });

  if (organizationId) q = q.eq("organization_id", organizationId);

  const { data: embarques, error } = await q;
  if (error) throw error;
  const arr = embarques ?? [];
  if (arr.length === 0) {
    return { filas: [], totalEmbarques: 0, totalUsd: 0, totalMxn: 0 };
  }

  const ids = arr.map((e) => e.id);
  const expedientes = Array.from(
    new Set(arr.map((e) => e.expediente).filter((x): x is string => !!x)),
  );

  const [ventasRes, facturasRes] = await Promise.all([
    supabase.from("conceptos_venta").select("embarque_id, total, moneda").in("embarque_id", ids),
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

  const facturadosSet = new Set<string>(
    (facturasRes.data ?? []).map((f) => f.expediente).filter((x): x is string => !!x),
  );

  const ventasMap = new Map<string, { monto: number; moneda: string }[]>();
  for (const v of ventasRes.data ?? []) {
    const list = ventasMap.get(v.embarque_id) ?? [];
    list.push({ monto: Number(v.total ?? 0), moneda: String(v.moneda ?? "MXN") });
    ventasMap.set(v.embarque_id, list);
  }

  const filas: FilaHueco[] = [];
  let totalUsd = 0;
  let totalMxn = 0;
  for (const e of arr) {
    if (!e.etd) continue;
    if (e.expediente && facturadosSet.has(e.expediente)) continue; // ya facturado
    const tcUsd = Number(e.tipo_cambio_usd ?? 1);
    const tcEur = Number(e.tipo_cambio_eur ?? 1);
    const ventas = ventasMap.get(e.id) ?? [];
    const ventaMxn = sumarConceptosEnMxn(ventas, tcUsd, tcEur);
    const ventaUsd = sumarConceptosEnUsd(ventas, tcUsd, tcEur);
    totalMxn += ventaMxn;
    totalUsd += ventaUsd;
    filas.push({
      embarque_id: e.id,
      expediente: e.expediente ?? "",
      cliente_nombre: e.cliente_nombre ?? "",
      operador: e.operador ?? "",
      etd: e.etd,
      eta: e.eta,
      diasDesdeEtd: diasDesde(e.etd, hoy),
      ventaMxn,
      ventaUsd,
    });
  }

  // Ordena por días desde ETD descendente (los más viejos primero).
  filas.sort((a, b) => b.diasDesdeEtd - a.diasDesdeEtd);

  return {
    filas,
    totalEmbarques: filas.length,
    totalUsd,
    totalMxn,
  };
}
