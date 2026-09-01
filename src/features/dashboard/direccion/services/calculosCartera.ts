import { format } from "date-fns";
/**
 * Cálculos de cartera y KPIs de cabecera/pulso del Dashboard Dirección.
 * Extraído de `calculos.ts` para respetar el límite de 200 líneas por archivo.
 */
import { calcularMargen, calcularUtilidad } from "@/lib/financial/financialUtils";
import { mxnFactura, type TcFallbacks } from "./mxn";
import { calcularSaldosCarteraMxn } from "./saldoCartera";

import type { EmbarqueEstadoRow, FacturaRow, NotaCreditoRow, PagoRow } from "./loaders";
import type { BucketAntiguedad, HeroKpis, PulsoKpis } from "./tipos";
import type { EmbarqueAgg } from "./calculos";
import { diasVencidos } from "@/lib/date/dateOnly";

/** Tolerancia de saldo (MXN) para considerar una factura cubierta. */
const TOLERANCIA_SALDO_MXN = 0.5;


export function calcularAntiguedad(
  facturas: FacturaRow[], pagos: PagoRow[], fallbacks: TcFallbacks, hoy: Date, ncs: NotaCreditoRow[] = [],
): BucketAntiguedad[] {
  const saldo = calcularSaldosCarteraMxn(facturas, pagos, ncs, fallbacks);
  const buckets: Record<BucketAntiguedad["bucket"], BucketAntiguedad> = {
    "Corriente": { bucket: "Corriente", monto_mxn: 0, facturas: 0 },
    "1-30": { bucket: "1-30", monto_mxn: 0, facturas: 0 },
    "31-60": { bucket: "31-60", monto_mxn: 0, facturas: 0 },
    "+60": { bucket: "+60", monto_mxn: 0, facturas: 0 },
  };
  for (const f of facturas) {
    const s = saldo.get(f.id) ?? 0;
    if (s <= TOLERANCIA_SALDO_MXN) continue;
    const dias = f.fecha_vencimiento ? diasVencidos(f.fecha_vencimiento, hoy) : 0;
    const key: BucketAntiguedad["bucket"] = dias <= 0 ? "Corriente" : dias <= 30 ? "1-30" : dias <= 60 ? "31-60" : "+60";
    buckets[key].monto_mxn += s; buckets[key].facturas += 1;
  }
  return [buckets.Corriente, buckets["1-30"], buckets["31-60"], buckets["+60"]];
}


export interface CalcularHeroParams {
  aggs: EmbarqueAgg[]; facturas: FacturaRow[];
  /**
   * P1-6: universo de cartera ABIERTA (toda factura viva con saldo
   * potencial > 0, sin ventana de fechas) — separado de `facturas` (ventana
   * de 6 meses) para no borrar del vencido/aging facturas más viejas.
   */
  facturasCartera: FacturaRow[];
  /** Pagos y NC aplicadas de la cartera abierta: sin ellos una factura ya
   *  cubierta seguía contando como cliente con vencido. */
  pagosCartera?: PagoRow[];
  ncsCartera?: NotaCreditoRow[];
  antiguedad: BucketAntiguedad[];
  /** Tipos de cambio de respaldo por moneda (USD/EUR). */
  fallbacks: TcFallbacks;
  hoy: Date; mesActual: string; mesPrev: string;
}

export function calcularHero(params: CalcularHeroParams): HeroKpis {
  const { aggs, facturas, facturasCartera, antiguedad, fallbacks, hoy, mesActual, mesPrev } = params;
  const cur = aggs.filter((a) => a.mes === mesActual);
  const prev = aggs.filter((a) => a.mes === mesPrev);
  const v = cur.reduce((s, a) => s + a.venta, 0);
  const c = cur.reduce((s, a) => s + a.costo, 0);
  const vP = prev.reduce((s, a) => s + a.venta, 0);
  const cP = prev.reduce((s, a) => s + a.costo, 0);
  const facturado = facturas
    .filter((f) => f.estado !== "Cancelada" && f.fecha_emision.slice(0, 7) === mesActual)
    .reduce((s, f) => s + mxnFactura(Number(f.total ?? 0), f.moneda, f.tipo_cambio, fallbacks), 0);
  const saldos = calcularSaldosCarteraMxn(
    facturasCartera, params.pagosCartera ?? [], params.ncsCartera ?? [], fallbacks,
  );
  const vencidas = facturasCartera.filter((f) => {
    if (f.estado === "Cancelada" || f.estado === "Pagada") return false;
    if (!f.fecha_vencimiento) return false;
    if ((saldos.get(f.id) ?? 0) <= TOLERANCIA_SALDO_MXN) return false;
    return new Date(`${f.fecha_vencimiento}T00:00:00Z`).getTime() < hoy.getTime();
  });
  const clientes = new Set(vencidas.map((f) => f.cliente_id).filter(Boolean));

  const vencidoTotal = antiguedad.filter((b) => b.bucket !== "Corriente").reduce((s, b) => s + b.monto_mxn, 0);
  return {
    utilidad_mxn: calcularUtilidad(v, c), venta_mxn: v, costo_mxn: c,
    margen_pct: calcularMargen(v, c), margen_pct_prev: calcularMargen(vP, cP),
    cartera_vencida_mxn: vencidoTotal, cartera_vencida_clientes: clientes.size,
    facturado_mes_mxn: facturado,
  };
}

/** Ola 4 · N21: días libres antes de marcar demora en aduana (canon operaciones_stats.v_dias_libres). */
const DIAS_LIBRES_DEMORA = 7;

export function calcularPulso(
  activos: EmbarqueEstadoRow[], facturas: FacturaRow[], hoy: Date, mesActual: string,
): PulsoKpis {
  const porEstado = new Map<string, number>();
  const en7d = new Date(hoy.getTime() + 7 * 86_400_000);
  let arribos_7d = 0; let demoras = 0;
  for (const r of activos) {
    const est = r.estado ?? "Sin estado";
    porEstado.set(est, (porEstado.get(est) ?? 0) + 1);
    if (r.eta) {
      // Ola 4 · N21: comparar por DÍA. `hoy` es un instante, así que un ETA de
      // hoy quedaba fuera de "arribos 7d" y cualquier ETA de hoy contaba como
      // demora desde la medianoche (comparación instante vs. medianoche).
      const etaDia = r.eta.slice(0, 10);
      // FE-04: día local MX; con `toISOString()` los KPIs cambiaban de día a
      // las 18:00 (UTC−6).
      const hoyDia = format(hoy, "yyyy-MM-dd");
      const en7dDia = format(en7d, "yyyy-MM-dd");
      if (etaDia >= hoyDia && etaDia <= en7dDia) arribos_7d += 1;
      const diasRetraso = diasVencidos(etaDia, hoyDia);
      // Ola 4 · N21: sólo demora tras los días libres del canon (>7), no
      // cualquier ETA pasada (antes marcaba demora desde el día siguiente).
      if (est === "En Aduana" && diasRetraso > DIAS_LIBRES_DEMORA) demoras += 1;
    }
  }
  const cfdi = facturas.filter((f) => f.uuid_fiscal && f.timbrado_en && f.timbrado_en.slice(0, 7) === mesActual).length;
  const acuses = facturas.filter((f) => f.estado === "Cancelada" && (f.acuse_cancelacion_status ?? "") !== "aceptado").length;
  return {
    embarques_activos: activos.length,
    embarques_por_estado: Array.from(porEstado.entries()).map(([estado, total]) => ({ estado, total })).sort((a, b) => b.total - a.total),
    arribos_7d, demoras, documentos_vencidos: null,
    cfdi_timbrados_mes: cfdi, acuses_pendientes: acuses,
  };
}
