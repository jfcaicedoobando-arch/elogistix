/**
 * KPIs ejecutivos del módulo Facturación: facturado del mes,
 * cobrado del mes y tendencia de 6 meses (facturado vs cobrado en MXN
 * equivalente usando `tipo_cambio` de la factura).
 *
 * "Por facturar", "Por cobrar" y "Vencido" se inyectan desde hooks
 * existentes (hueco de facturación y cobranza) para evitar duplicar lógica.
 */
import { supabase } from "@/integrations/supabase/client";

export interface MesKpi {
  mes: string; // 'YYYY-MM'
  facturado_mxn: number;
  cobrado_mxn: number;
}

export interface DashboardEjecutivoKpis {
  facturado_mes_mxn: number;
  cobrado_mes_mxn: number;
  tendencia: MesKpi[]; // últimos 6 meses (incluye el actual)
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function ym(d: Date): string {
  return d.toISOString().slice(0, 7);
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

function mxnEquivalente(monto: number, moneda: string, tipoCambio: number | null): number {
  const tc = moneda === "MXN" ? 1 : Number(tipoCambio ?? 0);
  return Number(monto) * (tc || 1);
}

function acumularFacturas(facturas: FacturaRow[], tendencia: MesKpi[], idxMes: Map<string, number>): void {
  for (const f of facturas) {
    const i = idxMes.get(f.fecha_emision.slice(0, 7));
    if (i === undefined) continue;
    tendencia[i].facturado_mxn += mxnEquivalente(f.total, f.moneda, f.tipo_cambio);
  }
}

function acumularPagos(pagos: PagoRow[], tendencia: MesKpi[], idxMes: Map<string, number>): void {
  for (const p of pagos) {
    const i = idxMes.get(p.fecha_pago.slice(0, 7));
    if (i === undefined) continue;
    tendencia[i].cobrado_mxn += mxnEquivalente(p.monto_aplicado_factura, p.moneda, p.tipo_cambio);
  }
}

export async function fetchDashboardEjecutivoFacturacion(
  organizationId: string | null,
  hoy: Date = new Date(),
): Promise<DashboardEjecutivoKpis> {
  const { desde, rangos } = ultimosNMeses(6, hoy);
  const desdeIso = ymd(desde);

  let qFacturas = supabase
    .from("facturas")
    .select("fecha_emision, total, moneda, tipo_cambio, estado")
    .gte("fecha_emision", desdeIso)
    .neq("estado", "Cancelada")
    .is("deleted_at", null)
    .limit(5000);
  if (organizationId) qFacturas = qFacturas.eq("organization_id", organizationId);

  let qPagos = supabase
    .from("pagos_factura")
    .select("fecha_pago, monto_aplicado_factura, tipo_cambio, moneda")
    .gte("fecha_pago", desdeIso)
    .is("deleted_at", null)
    .limit(10000);
  if (organizationId) qPagos = qPagos.eq("organization_id", organizationId);

  const [{ data: facturas, error: e1 }, { data: pagos, error: e2 }] = await Promise.all([qFacturas, qPagos]);
  if (e1) throw e1;
  if (e2) throw e2;

  const tendencia: MesKpi[] = rangos.map((r) => ({ mes: r.mes, facturado_mxn: 0, cobrado_mxn: 0 }));
  const idxMes = new Map(rangos.map((r, i) => [r.mes, i]));

  acumularFacturas((facturas ?? []) as FacturaRow[], tendencia, idxMes);
  acumularPagos((pagos ?? []) as PagoRow[], tendencia, idxMes);

  const actual = tendencia[tendencia.length - 1] ?? { facturado_mxn: 0, cobrado_mxn: 0 };
  return {
    facturado_mes_mxn: actual.facturado_mxn,
    cobrado_mes_mxn: actual.cobrado_mxn,
    tendencia,
  };
}

