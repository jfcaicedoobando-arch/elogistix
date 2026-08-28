/**
 * Finanzas del cliente: facturación acumulada, pendiente y utilidad.
 *
 * Ola 6 · M1 (auditoría 3): antes se sumaban los totales de todas las facturas
 * como si fueran USD (100 USD + 100 MXN = 200 "USD"). Ahora todo se expresa en
 * MXN convirtiendo cada factura con SU tipo de cambio (canon `aMxn`), y lo que
 * no se puede convertir por falta de TC se cuenta aparte en vez de sumarse mal.
 */
import { supabase } from "@/integrations/supabase/client";
import { FACTURA_ESTADOS_VIVOS } from "@/lib/domain/estadosFactura";
import { aMxn } from "@/lib/financial/convertir";

export interface ClienteFinancials {
  facturadoMXN: number;
  pendienteMXN: number;
  profitMXN: number;
  /** Facturas excluidas de los totales por no tener tipo de cambio confiable. */
  facturasSinTc: number;
  /** Embarques del cliente cuya utilidad no pudo convertirse (reporta la RPC). */
  embarquesSinTc: number;
}

interface ProfitRow {
  cliente_id: string;
  venta_mxn: number | null;
  costo_mxn: number | null;
  embarques_sin_tc: number | null;
}

const FACTURA_COLS = "total, moneda, estado, tipo_cambio, embarque_id" as const;

export async function fetchClienteFinancials(clienteId: string): Promise<ClienteFinancials> {
  // Filtra Cancelada y Sustituida server-side: no forman parte del facturado
  // vigente al cliente. Ref: FACTURA_ESTADOS_VIVOS.
  const { data: facturas, error: errF } = await supabase
    .from("facturas")
    .select(FACTURA_COLS)
    .eq("cliente_id", clienteId)
    .in("estado", [...FACTURA_ESTADOS_VIVOS])
    .is("deleted_at", null);
  if (errF) throw errF;

  let facturadoMXN = 0;
  let pendienteMXN = 0;
  let facturasSinTc = 0;
  for (const f of facturas ?? []) {
    const conv = aMxn(f.total ?? 0, f.moneda, f.tipo_cambio);
    if (!conv.completo) {
      facturasSinTc += 1;
      continue;
    }
    facturadoMXN += conv.monto;
    if (f.estado === "Emitida" || f.estado === "Vencida") {
      pendienteMXN += conv.monto;
    }
  }

  const { data: profitData, error: errP } = await supabase.rpc("profit_por_cliente", {
    _fecha_desde: undefined,
    _fecha_hasta: undefined,
    _modo: undefined,
  });
  if (errP) throw errP;

  const fila = (profitData as ProfitRow[] | null ?? []).find((r) => r.cliente_id === clienteId);
  const ventaMXN = Number(fila?.venta_mxn ?? 0);
  const costoMXN = Number(fila?.costo_mxn ?? 0);

  return {
    facturadoMXN,
    pendienteMXN,
    profitMXN: ventaMXN - costoMXN,
    facturasSinTc,
    embarquesSinTc: Number(fila?.embarques_sin_tc ?? 0),
  };
}
