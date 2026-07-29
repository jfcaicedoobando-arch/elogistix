/**
 * Servicio de Estado de Cuenta por cliente.
 *
 * Mismo shape que `fetchCobranza`, pero acepta múltiples `cliente_id`s (para
 * el portal, donde un `client_user` puede estar ligado a varios clientes) y
 * devuelve el detalle desglosado de pagos y notas de crédito por factura,
 * necesario para el modo "fila colapsable con pagos anidados".
 *
 * Los tipos y el mapeo puro viven en `estadoCuentaTypes.ts`.
 */
import { supabase } from "@/integrations/supabase/client";
import { assertNotTruncated } from "@/lib/supabase/assertNotTruncated";
import {
  KPIS_ESTADO_CUENTA_VACIOS,
  mapFacturaEstadoCuenta,
  type EstadoCuentaFilters,
  type FacturaEstadoCuenta,
  type KpisEstadoCuentaRemotos,
  type RawFactura,
} from "./estadoCuentaTypes";

export type {
  EstatusCobranza,
  FacturaEstadoCuenta,
  EstadoCuentaFilters,
  KpisEstadoCuentaRemotos,
} from "./estadoCuentaTypes";

/**
 * FIX C3c (S6-03): KPIs de adeudo agregados en SQL sobre el universo del
 * cliente (uso interno y portal). El detalle con pagos/NC sigue vía
 * `fetchEstadoCuenta` + guarda anti-truncamiento.
 */
export async function fetchEstadoCuentaKpis(
  filters: EstadoCuentaFilters,
): Promise<KpisEstadoCuentaRemotos> {
  if (!filters.clienteIds.length) return KPIS_ESTADO_CUENTA_VACIOS;
  const { data, error } = await supabase.rpc("estado_cuenta_agregados", {
    p_cliente_ids: filters.clienteIds,
    p_desde: filters.desde ?? undefined,
    p_hasta: filters.hasta ?? undefined,
  });
  if (error) throw error;
  // SAFE-CAST: jsonb con el shape de la migración C3c.
  return (data as unknown as KpisEstadoCuentaRemotos) ?? KPIS_ESTADO_CUENTA_VACIOS;
}

const ESTADOS_ACTIVOS = ["Emitida", "Parcialmente pagada", "Vencida", "Pagada"] as const;

// FIX C3 (S6-03): cap explícito verificado; el estado de cuenta alimenta
// KPIs de adeudo hacia el cliente (portal).
const LIMITE_ESTADO_CUENTA = 2000;

export async function fetchEstadoCuenta(filters: EstadoCuentaFilters): Promise<FacturaEstadoCuenta[]> {
  if (!filters.clienteIds.length) return [];

  let query = supabase
    .from("facturas")
    .select(`
      id, numero, cliente_id, cliente_nombre, expediente,
      moneda, total, fecha_emision, fecha_vencimiento, estado,
      pagos_factura(id, fecha_pago, monto, moneda, tipo_cambio, monto_aplicado_factura, forma_pago, referencia, deleted_at),
      factura_notas_credito(id, folio, fecha_emision, monto, estado, deleted_at)
    `)
    .in("cliente_id", filters.clienteIds)
    .in("estado", [...ESTADOS_ACTIVOS])
    .order("fecha_emision", { ascending: false })
    .limit(LIMITE_ESTADO_CUENTA);

  if (filters.desde) query = query.gte("fecha_emision", filters.desde);
  if (filters.hasta) query = query.lte("fecha_emision", filters.hasta);
  if (filters.moneda && filters.moneda !== "todas") query = query.eq("moneda", filters.moneda);

  const { data, error } = await query;
  if (error) throw error;
  assertNotTruncated(data, LIMITE_ESTADO_CUENTA, "facturacion.fetchEstadoCuenta");

  // SAFE-CAST: el shape de joins embebidos no lo infiere Supabase.
  const rows = ((data as unknown as RawFactura[] | null) ?? []).map(mapFacturaEstadoCuenta);

  return filters.soloConSaldo ? rows.filter((r) => r.saldo > 0.01) : rows;
}
