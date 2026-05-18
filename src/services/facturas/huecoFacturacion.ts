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

const DIAS_UMBRAL = 5;

function diasDesde(fechaIso: string, hoy = new Date()): number {
  const d = new Date(fechaIso + "T00:00:00");
  return Math.floor((hoy.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

type EmbarqueHueco = {
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
};

async function fetchEmbarquesParaHueco(
  organizationId: string | null,
  limiteIso: string,
): Promise<EmbarqueHueco[]> {
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

async function fetchVentasYFacturas(ids: string[], expedientes: string[]) {
  const [ventasRes, facturasRes] = await Promise.all([
    supabase.from("conceptos_venta").select("embarque_id, total, moneda").in("embarque_id", ids),
    expedientes.length > 0
      ? supabase
          .from("facturas")
          .select("expediente, factura_pdf_url")
          .in("expediente", expedientes)
          .not("factura_pdf_url", "is", null)
      : Promise.resolve({ data: [] as { expediente: string | null; factura_pdf_url: string | null }[], error: null }),
  ]);
  if (ventasRes.error) throw ventasRes.error;
  if (facturasRes.error) throw facturasRes.error;
  return { ventas: ventasRes.data ?? [], facturas: facturasRes.data ?? [] };
}

function indexarVentas(rows: { embarque_id: string; total: number | null; moneda: string | null }[]) {
  const map = new Map<string, { monto: number; moneda: string }[]>();
  for (const v of rows) {
    const list = map.get(v.embarque_id) ?? [];
    list.push({ monto: Number(v.total ?? 0), moneda: String(v.moneda ?? "MXN") });
    map.set(v.embarque_id, list);
  }
  return map;
}

function construirFila(
  e: EmbarqueHueco,
  ventasMap: Map<string, { monto: number; moneda: string }[]>,
  hoy: Date,
): FilaHueco | null {
  if (!e.etd) return null;
  const tcUsd = Number(e.tipo_cambio_usd ?? 1);
  const tcEur = Number(e.tipo_cambio_eur ?? 1);
  const ventas = ventasMap.get(e.id) ?? [];
  return {
    embarque_id: e.id,
    expediente: e.expediente ?? "",
    cliente_nombre: e.cliente_nombre ?? "",
    operador: e.operador ?? "",
    etd: e.etd,
    eta: e.eta,
    bl_master: e.bl_master ?? null,
    bl_house: e.bl_house ?? null,
    diasDesdeEtd: diasDesde(e.etd, hoy),
    ventaMxn: sumarConceptosEnMxn(ventas, tcUsd, tcEur),
    ventaUsd: sumarConceptosEnUsd(ventas, tcUsd, tcEur),
  };
}

export async function fetchHuecoFacturacion({
  organizationId,
  hoy = new Date(),
}: {
  organizationId: string | null;
  hoy?: Date;
}): Promise<HuecoFacturacionResult> {
  const limite = new Date(hoy);
  limite.setDate(limite.getDate() - DIAS_UMBRAL - 1);
  const limiteIso = limite.toISOString().slice(0, 10);

  const arr = await fetchEmbarquesParaHueco(organizationId, limiteIso);
  if (arr.length === 0) {
    return { filas: [], totalEmbarques: 0, totalUsd: 0, totalMxn: 0 };
  }

  const ids = arr.map((e) => e.id);
  const expedientes = Array.from(
    new Set(arr.map((e) => e.expediente).filter((x): x is string => !!x)),
  );

  const { ventas, facturas } = await fetchVentasYFacturas(ids, expedientes);
  const facturadosSet = new Set<string>(
    facturas.map((f) => f.expediente).filter((x): x is string => !!x),
  );
  const ventasMap = indexarVentas(ventas);

  const filas: FilaHueco[] = [];
  let totalUsd = 0;
  let totalMxn = 0;
  for (const e of arr) {
    if (e.expediente && facturadosSet.has(e.expediente)) continue;
    const fila = construirFila(e, ventasMap, hoy);
    if (!fila) continue;
    totalMxn += fila.ventaMxn;
    totalUsd += fila.ventaUsd;
    filas.push(fila);
  }

  filas.sort((a, b) => b.diasDesdeEtd - a.diasDesdeEtd);

  return { filas, totalEmbarques: filas.length, totalUsd, totalMxn };
}
