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
import { assertNotTruncated } from "@/lib/supabase/assertNotTruncated";
import { escapeIlike } from "@/lib/search/ilike";

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


// FIX C3 (S6-02): cap explícito verificado por assertNotTruncated.
const LIMITE_COBRANZA = 2000;

/**
 * B.5 — El filtrado por estatus vive en la BD (`cobranza_listado`), no en el
 * navegador. Antes se traían 2000 filas y se filtraba en memoria: con cartera
 * grande el corte de 2000 dejaba fuera facturas vencidas y el listado no
 * cuadraba con los KPIs. La RPC aplica el mismo canon de vencimiento.
 */
export async function fetchCobranza(filtros: FetchCobranzaFilters = {}): Promise<FacturaCobranza[]> {
  const { data, error } = await supabase.rpc("cobranza_listado", {
    p_cliente_id: filtros.cliente_id ?? undefined,
    p_moneda: filtros.moneda && filtros.moneda !== "todas" ? filtros.moneda : undefined,
    p_estatus: filtros.estatus && filtros.estatus !== "todos" ? filtros.estatus : undefined,
    // Ola v16 (4): `cobranza_listado` arma el patrón `%term%`; sin escapar,
    // un `%` o `_` tecleado por el usuario actuaba como comodín y traía
    // facturas que no coinciden. Se envía el término como literal.
    p_search: filtros.search ? escapeIlike(filtros.search) : undefined,
    p_limit: LIMITE_COBRANZA,
  });
  if (error) throw error;
  assertNotTruncated(data, LIMITE_COBRANZA, "facturacion.fetchCobranza");

  // SAFE-CAST: la RPC devuelve `moneda`/`estado` como text; el dominio los tipa
  // con los enums de la tabla `facturas`, que son exactamente esos valores.
  return (data ?? []).map((f): FacturaCobranza => ({
    id: f.id,
    numero: f.numero,
    cliente_id: f.cliente_id,
    cliente_nombre: f.cliente_nombre,
    expediente: f.expediente,
    moneda: f.moneda as FacturaRow["moneda"],
    total: Number(f.total),
    pagado: Number(f.pagado),
    notas_credito_aplicadas: Number(f.notas_credito_aplicadas),
    saldo: Number(f.saldo),
    fecha_emision: f.fecha_emision,
    fecha_vencimiento: f.fecha_vencimiento,
    // Signo importa: negativo = faltan N días, 0 = vence hoy, positivo = vencida.
    dias_vencido: Number(f.dias_vencido),
    estatus_cobranza: f.estatus_cobranza as EstatusCobranza,
    estado_factura: f.estado_factura as FacturaRow["estado"],
    tipo_cambio: Number(f.tipo_cambio),
  }));
}


