/**
 * KPIs ejecutivos del módulo Facturación: facturado del mes,
 * cobrado del mes y tendencia de 6 meses (facturado vs cobrado en MXN
 * equivalente usando `tipo_cambio` de la factura).
 *
 * v13.135.72: si una factura USD no tiene `tipo_cambio` capturado, se usa
 * el fallback `fallbackUsdMxn` (típicamente el TC del día desde
 * `fetchExchangeRates`). Si tampoco hay fallback, la factura se excluye del
 * MXN equivalente y se cuenta en `facturas_sin_tc` para que la UI pueda
 * advertir. Antes, el `|| 1` silencioso sumaba USD como si fueran MXN 1:1.
 */
import { supabase } from "@/integrations/supabase/client";
import { assertNotTruncated } from "@/lib/supabase/assertNotTruncated";

/**
 * Estados que representan una factura efectivamente facturada (timbrada) para
 * los KPIs de "Facturado mes" y la tendencia. Excluye `Borrador` (aún no
 * timbrado) y `Cancelada` (revertida).
 */
export const ESTADOS_FACTURADO = ["Emitida", "Parcialmente pagada", "Vencida", "Pagada"] as const;

export interface MesKpi {
  mes: string; // 'YYYY-MM'
  facturado_mxn: number;
  cobrado_mxn: number;
}

export interface DashboardEjecutivoKpis {
  facturado_mes_mxn: number;
  cobrado_mes_mxn: number;
  tendencia: MesKpi[]; // últimos 6 meses (incluye el actual)
  /** Facturas USD del mes en curso sin tipo_cambio capturado ni fallback aplicable. */
  facturas_sin_tc: number;
}

// FIX-12 · Los helpers `ymd`/`ym` operan sobre `Date` construidos con `Date.UTC(...)`
// (inicios de mes UTC), así que deben leerse en UTC — de lo contrario CDMX corre
// "junio 01 00:00Z" a "mayo 31" y las etiquetas de rango se desalinean.
// La corrección real de zona horaria se aplica al `hoy` de negocio en el caller
// (parseLocalMx(hoyMx()) antes de derivar rangos).
import { hoyMx, isoUtcDay, parseLocalMx } from "@/lib/date/mx";

function ymd(d: Date): string {
  return isoUtcDay(d);
}

function ym(d: Date): string {
  return isoUtcDay(d).slice(0, 7);
}

function inicioMes(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function ultimosNMeses(n: number, hoy: Date): { desde: Date; rangos: Array<{ inicio: Date; fin: Date; mes: string }> } {
  const base = inicioMes(hoy);
  const desde = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - (n - 1), 1));
  const rangos: Array<{ inicio: Date; fin: Date; mes: string }> = [];
  for (let i = 0; i < n; i++) {
    const inicio = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth() + i, 1));
    const fin = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 1));
    rangos.push({ inicio, fin, mes: ym(inicio) });
  }
  return { desde, rangos };
}

type FacturaRow = { fecha_emision: string; total: number; moneda: string; tipo_cambio: number | null };
type PagoRow = { fecha_pago: string; monto_aplicado_factura: number; tipo_cambio: number | null; moneda: string };

/** Devuelve el MXN equivalente o `null` si no se pudo convertir (USD/EUR con TC inválido y sin fallback). */
function mxnEquivalente(monto: number, moneda: string, tipoCambio: number | null, fallback: number): number | null {
  if (moneda === "MXN") return Number(monto);
  const tc = Number(tipoCambio) || 0;
  // tc <= 1 se considera inválido para monedas extranjeras: 1 USD/EUR nunca es 1 MXN.
  if (tc > 1) return Number(monto) * tc;
  if (fallback > 0) return Number(monto) * fallback;
  return null;
}


function acumularFacturas(
  facturas: FacturaRow[],
  tendencia: MesKpi[],
  idxMes: Map<string, number>,
  fallback: number,
  mesActual: string,
): number {
  let sinTcMesActual = 0;
  for (const f of facturas) {
    const ymStr = f.fecha_emision.slice(0, 7);
    const i = idxMes.get(ymStr);
    if (i === undefined) continue;
    const eq = mxnEquivalente(f.total, f.moneda, f.tipo_cambio, fallback);
    if (eq === null) {
      if (ymStr === mesActual) sinTcMesActual += 1;
      continue;
    }
    tendencia[i].facturado_mxn += eq;
  }
  return sinTcMesActual;
}

function acumularPagos(
  pagos: PagoRow[],
  tendencia: MesKpi[],
  idxMes: Map<string, number>,
  fallback: number,
): void {
  for (const p of pagos) {
    const i = idxMes.get(p.fecha_pago.slice(0, 7));
    if (i === undefined) continue;
    const eq = mxnEquivalente(p.monto_aplicado_factura, p.moneda, p.tipo_cambio, fallback);
    if (eq === null) continue;
    tendencia[i].cobrado_mxn += eq;
  }
}

// FIX C3 (S6-04): caps explícitos verificados por assertNotTruncated.
const LIMITE_FACTURAS_KPI = 5000;
const LIMITE_PAGOS_KPI = 10000;

export async function fetchDashboardEjecutivoFacturacion(
  organizationId: string | null,
  fallbackUsdMxn: number | null = null,
  hoy: Date = new Date(),
): Promise<DashboardEjecutivoKpis> {
  // FIX-12 · Ancla "hoy" al día CDMX antes de derivar los rangos de mes.
  // A las 22:00 CDMX del último día del mes, el `new Date()` en UTC ya está en
  // el mes siguiente, y "Facturado del mes" arrancaba en el mes equivocado.
  const hoyLocal = parseLocalMx(hoyMx(hoy));
  const hoyUtc = new Date(Date.UTC(hoyLocal.getFullYear(), hoyLocal.getMonth(), hoyLocal.getDate()));
  const { desde, rangos } = ultimosNMeses(6, hoyUtc);
  const desdeIso = ymd(desde);
  const fallback = Number(fallbackUsdMxn ?? 0) || 0;

  let qFacturas = supabase
    .from("facturas")
    .select("fecha_emision, total, moneda, tipo_cambio, estado")
    .gte("fecha_emision", desdeIso)
    .in("estado", [...ESTADOS_FACTURADO])
    .is("deleted_at", null)
    .limit(LIMITE_FACTURAS_KPI);
  if (organizationId) qFacturas = qFacturas.eq("organization_id", organizationId);

  let qPagos = supabase
    .from("pagos_factura")
    .select("fecha_pago, monto_aplicado_factura, tipo_cambio, moneda")
    .gte("fecha_pago", desdeIso)
    .is("deleted_at", null)
    .limit(LIMITE_PAGOS_KPI);
  if (organizationId) qPagos = qPagos.eq("organization_id", organizationId);

  const [{ data: facturas, error: e1 }, { data: pagos, error: e2 }] = await Promise.all([qFacturas, qPagos]);
  if (e1) throw e1;
  if (e2) throw e2;
  assertNotTruncated(facturas, LIMITE_FACTURAS_KPI, "facturacion.dashboardEjecutivo.facturas");
  assertNotTruncated(pagos, LIMITE_PAGOS_KPI, "facturacion.dashboardEjecutivo.pagos");

  const tendencia: MesKpi[] = rangos.map((r) => ({ mes: r.mes, facturado_mxn: 0, cobrado_mxn: 0 }));
  const idxMes = new Map(rangos.map((r, i) => [r.mes, i]));
  const mesActual = rangos[rangos.length - 1]?.mes ?? "";

  const sinTc = acumularFacturas((facturas ?? []) as FacturaRow[], tendencia, idxMes, fallback, mesActual);
  acumularPagos((pagos ?? []) as PagoRow[], tendencia, idxMes, fallback);

  const actual = tendencia[tendencia.length - 1] ?? { facturado_mxn: 0, cobrado_mxn: 0 };
  return {
    facturado_mes_mxn: actual.facturado_mxn,
    cobrado_mes_mxn: actual.cobrado_mxn,
    tendencia,
    facturas_sin_tc: sinTc,
  };
}
