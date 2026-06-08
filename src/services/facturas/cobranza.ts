/**
 * Servicio de Cobranza (CxC – Sprint 1).
 *
 * Lista facturas activas (no canceladas, no soft-deleted) y calcula el saldo
 * pendiente como:
 *
 *   saldo = total − Σ(pagos_factura.monto_aplicado_factura)
 *                 − Σ(notas_credito.monto WHERE estado='Aplicada')
 *
 * Se hace en una sola consulta usando relaciones embebidas; suficiente para
 * la cartera típica del Contador (decenas a cientos de facturas). Si el
 * volumen crece, migrar a vista `v_facturas_saldo` o RPC dedicado.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { sumarMontos } from "@/lib/financial/financialUtils";

type FacturaRow = Tables<"facturas">;

export type EstatusCobranza = "Vigente" | "Por vencer" | "Vencida" | "Pagada" | "Sin saldo";

export interface FacturaCobranza {
  id: string;
  numero: string;
  cliente_id: string;
  cliente_nombre: string;
  expediente: string;
  moneda: FacturaRow["moneda"];
  total: number;
  pagado: number;
  notas_credito_aplicadas: number;
  saldo: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  dias_vencido: number;
  estatus_cobranza: EstatusCobranza;
  estado_factura: FacturaRow["estado"];
  tipo_cambio: number;
}

const ESTADOS_ACTIVOS = ["Emitida", "Parcialmente pagada", "Vencida"] as const;

interface FetchCobranzaFilters {
  search?: string;
  cliente_id?: string;
  moneda?: FacturaRow["moneda"] | "todas";
  estatus?: EstatusCobranza | "todos";
}

type RawFactura = Pick<
  FacturaRow,
  | "id" | "numero" | "cliente_id" | "cliente_nombre" | "expediente"
  | "moneda" | "total" | "fecha_emision" | "fecha_vencimiento"
  | "estado" | "tipo_cambio"
> & {
  pagos_factura: Array<{ monto_aplicado_factura: number; deleted_at: string | null }> | null;
  factura_notas_credito: Array<{ monto: number; estado: string; deleted_at: string | null }> | null;
};

function calcularDiasVencido(fechaVencimiento: string): number {
  const venc = new Date(fechaVencimiento + "T00:00:00");
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.floor((hoy.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
}

function calcularEstatus(saldo: number, diasVencido: number): EstatusCobranza {
  if (saldo <= 0.01) return "Sin saldo";
  if (diasVencido > 0) return "Vencida";
  if (diasVencido >= -3) return "Por vencer";
  return "Vigente";
}

export async function fetchCobranza(filtros: FetchCobranzaFilters = {}): Promise<FacturaCobranza[]> {
  let query = supabase
    .from("facturas")
    .select(`
      id, numero, cliente_id, cliente_nombre, expediente,
      moneda, total, fecha_emision, fecha_vencimiento, estado, tipo_cambio,
      pagos_factura(monto_aplicado_factura, deleted_at),
      factura_notas_credito(monto, estado, deleted_at)
    `)
    .in("estado", [...ESTADOS_ACTIVOS])
    .order("fecha_vencimiento", { ascending: true })
    .limit(2000);

  if (filtros.cliente_id) query = query.eq("cliente_id", filtros.cliente_id);
  if (filtros.moneda && filtros.moneda !== "todas") query = query.eq("moneda", filtros.moneda);
  if (filtros.search) {
    query = query.or(`numero.ilike.%${filtros.search}%,cliente_nombre.ilike.%${filtros.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  // SAFE-CAST: `RawFactura` modela el join con pagos_factura; Supabase tipa unknown.
  const rows = ((data as unknown as RawFactura[] | null) ?? []).map((f): FacturaCobranza => {
    const pagado = (f.pagos_factura ?? [])
      .filter((p) => !p.deleted_at)
      .reduce((s, p) => s + Number(p.monto_aplicado_factura), 0);
    const notas = (f.factura_notas_credito ?? [])
      .filter((n) => !n.deleted_at && n.estado === "Aplicada")
      .reduce((s, n) => s + Number(n.monto), 0);
    const total = Number(f.total);
    const saldo = Math.max(0, total - pagado - notas);
    const diasVencido = calcularDiasVencido(f.fecha_vencimiento);
    return {
      id: f.id,
      numero: f.numero,
      cliente_id: f.cliente_id,
      cliente_nombre: f.cliente_nombre,
      expediente: f.expediente,
      moneda: f.moneda,
      total,
      pagado,
      notas_credito_aplicadas: notas,
      saldo,
      fecha_emision: f.fecha_emision,
      fecha_vencimiento: f.fecha_vencimiento,
      dias_vencido: Math.max(0, diasVencido),
      estatus_cobranza: calcularEstatus(saldo, diasVencido),
      estado_factura: f.estado,
      tipo_cambio: Number(f.tipo_cambio),
    };
  });

  if (filtros.estatus && filtros.estatus !== "todos") {
    return rows.filter((r) => r.estatus_cobranza === filtros.estatus);
  }
  return rows;
}

export interface KPIsCobranza {
  total_mxn: number;
  total_usd: number;
  vencido_mxn: number;
  vencido_usd: number;
  por_vencer_7d_mxn: number;
  por_vencer_7d_usd: number;
  facturas_vencidas: number;
}

export interface SaldosPorMoneda {
  saldoPendienteMXN: number;
  saldoPendienteUSD: number;
  /** Saldos por código de moneda no canónica (EUR, etc.) que NO se mezclan con los buckets oficiales. */
  porMoneda: Record<string, number>;
  /** Cantidad de filas con moneda fuera de {MXN,USD} que fueron descartadas de los buckets canónicos. */
  descartadas: number;
}

/**
 * Agrupa saldos pendientes por moneda SIN mezclar divisas.
 * Filas con `saldo <= 0` se ignoran. Filas con moneda ajena a {MXN,USD} se
 * registran aparte en `porMoneda` y NUNCA contaminan los buckets canónicos.
 * Usa `sumarMontos` (currency.js, precisión 2) para evitar drift de float.
 */
export function agruparSaldosPorMoneda(filas: FacturaCobranza[]): SaldosPorMoneda {
  const bucketMXN: number[] = [];
  const bucketUSD: number[] = [];
  const otros: Record<string, number[]> = {};
  let descartadas = 0;

  for (const f of filas) {
    if (f.saldo <= 0) continue;
    if (f.moneda === "MXN") bucketMXN.push(f.saldo);
    else if (f.moneda === "USD") bucketUSD.push(f.saldo);
    else {
      const key = String(f.moneda ?? "DESCONOCIDA");
      (otros[key] ??= []).push(f.saldo);
      descartadas++;
    }
  }

  const porMoneda: Record<string, number> = {};
  for (const [k, arr] of Object.entries(otros)) porMoneda[k] = sumarMontos(arr);

  if (descartadas > 0) {
    console.warn(
      `[cobranza] ${descartadas} factura(s) con moneda no canónica descartada(s) de los buckets MXN/USD:`,
      Object.keys(otros),
    );
  }

  return {
    saldoPendienteMXN: sumarMontos(bucketMXN),
    saldoPendienteUSD: sumarMontos(bucketUSD),
    porMoneda,
    descartadas,
  };
}

export function calcularKPIs(filas: FacturaCobranza[]): KPIsCobranza {
  const vencidoMXN: number[] = [];
  const vencidoUSD: number[] = [];
  const porVencerMXN: number[] = [];
  const porVencerUSD: number[] = [];
  let facturas_vencidas = 0;

  for (const f of filas) {
    if (f.saldo <= 0) continue;
    if (f.moneda !== "MXN" && f.moneda !== "USD") continue; // guard estricto
    const esUsd = f.moneda === "USD";
    if (f.estatus_cobranza === "Vencida") {
      facturas_vencidas++;
      (esUsd ? vencidoUSD : vencidoMXN).push(f.saldo);
    }
    if (f.dias_vencido <= 0 && f.dias_vencido >= -7) {
      (esUsd ? porVencerUSD : porVencerMXN).push(f.saldo);
    }
  }

  const { saldoPendienteMXN, saldoPendienteUSD } = agruparSaldosPorMoneda(filas);

  return {
    total_mxn: saldoPendienteMXN,
    total_usd: saldoPendienteUSD,
    vencido_mxn: sumarMontos(vencidoMXN),
    vencido_usd: sumarMontos(vencidoUSD),
    por_vencer_7d_mxn: sumarMontos(porVencerMXN),
    por_vencer_7d_usd: sumarMontos(porVencerUSD),
    facturas_vencidas,
  };
}
