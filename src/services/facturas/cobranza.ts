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

  const rows = ((data as RawFactura[] | null) ?? []).map((f): FacturaCobranza => {
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

export function calcularKPIs(filas: FacturaCobranza[]): KPIsCobranza {
  const kpis: KPIsCobranza = {
    total_mxn: 0, total_usd: 0,
    vencido_mxn: 0, vencido_usd: 0,
    por_vencer_7d_mxn: 0, por_vencer_7d_usd: 0,
    facturas_vencidas: 0,
  };
  for (const f of filas) {
    if (f.saldo <= 0) continue;
    const esUsd = f.moneda === "USD";
    if (esUsd) kpis.total_usd += f.saldo; else kpis.total_mxn += f.saldo;
    if (f.estatus_cobranza === "Vencida") {
      kpis.facturas_vencidas++;
      if (esUsd) kpis.vencido_usd += f.saldo; else kpis.vencido_mxn += f.saldo;
    }
    if (f.dias_vencido <= 0 && f.dias_vencido >= -7) {
      if (esUsd) kpis.por_vencer_7d_usd += f.saldo; else kpis.por_vencer_7d_mxn += f.saldo;
    }
  }
  return kpis;
}
