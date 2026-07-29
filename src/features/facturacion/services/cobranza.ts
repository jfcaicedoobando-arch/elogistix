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
import { orIlike } from "@/lib/search/ilike";
import { assertNotTruncated } from "@/lib/supabase/assertNotTruncated";

// Re-export de agregados puros (extraídos a `cobranzaAggregates.ts` en 12.61.18).
export {
  agruparSaldosPorMoneda,
  calcularKPIs,
  
  
} from "./cobranzaAggregates";

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

export interface FetchCobranzaFilters {
  search?: string;
  cliente_id?: string;
  moneda?: FacturaRow["moneda"] | "todas";
  estatus?: EstatusCobranza | "todos";
}

/** Shape del jsonb de `cobranza_agregados` (C3c): espejo de `KPIsCobranza`. */
export interface KpisCobranzaRemotos {
  total_mxn: number;
  total_usd: number;
  vencido_mxn: number;
  vencido_usd: number;
  por_vencer_7d_mxn: number;
  por_vencer_7d_usd: number;
  facturas_vencidas: number;
  facturas_con_saldo: number;
}

/**
 * FIX C3c (S6-02): KPIs de cartera agregados en SQL sobre el UNIVERSO completo
 * de facturas activas — no sobre la página visible (que sigue limitada y
 * protegida por `assertNotTruncated`). Usar en las tarjetas de totales;
 * `calcularKPIs(rows)` queda solo para agregados de la página cargada.
 */
export async function fetchCobranzaKpis(
  filtros: FetchCobranzaFilters = {},
): Promise<KpisCobranzaRemotos> {
  const { data, error } = await supabase.rpc("cobranza_agregados", {
    p_cliente_id: filtros.cliente_id ?? undefined,
    p_moneda: filtros.moneda && filtros.moneda !== "todas" ? filtros.moneda : undefined,
  });
  if (error) throw error;
  // SAFE-CAST: jsonb con el shape de la migración C3c.
  return data as unknown as KpisCobranzaRemotos;
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

// FIX C3 (S6-02): cap explícito verificado por assertNotTruncated.
const LIMITE_COBRANZA = 2000;

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
    .limit(LIMITE_COBRANZA);

  if (filtros.cliente_id) query = query.eq("cliente_id", filtros.cliente_id);
  if (filtros.moneda && filtros.moneda !== "todas") query = query.eq("moneda", filtros.moneda);
  if (filtros.search) {
    query = query.or(orIlike(["numero", "cliente_nombre"], filtros.search));
  }

  const { data, error } = await query;
  if (error) throw error;
  assertNotTruncated(data, LIMITE_COBRANZA, "facturacion.fetchCobranza");

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
      // Signo importa: negativo = faltan N días, 0 = vence hoy, positivo = días vencidos.
      // Este valor lo consume `agingPorCobrarBucket` y `cobranzaAggregates` para clasificar
      // "Por vencer" vs "Vencida". Un clamp a 0 rompe la bandeja "Por cobrar".
      dias_vencido: diasVencido,
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

