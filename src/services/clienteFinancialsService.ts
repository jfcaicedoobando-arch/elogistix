/**
 * Servicio de finanzas del cliente: facturación acumulada, pendiente y profit.
 * Encapsula consultas a `facturas` y la RPC `profit_por_cliente`.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ClienteFinancials {
  facturadoUSD: number;
  pendienteUSD: number;
  profitUSD: number;
}

interface ProfitRow {
  cliente_id: string;
  venta_usd: number | null;
  costo_usd: number | null;
}

export async function fetchClienteFinancials(clienteId: string): Promise<ClienteFinancials> {
  const { data: facturas, error: errF } = await supabase
    .from("facturas")
    .select("total, moneda, estado, embarque_id")
    .eq("cliente_id", clienteId);
  if (errF) throw errF;

  let facturadoUSD = 0;
  let pendienteUSD = 0;
  for (const f of facturas ?? []) {
    const monto = f.total ?? 0;
    facturadoUSD += monto;
    if (f.estado === "Emitida" || f.estado === "Vencida") {
      pendienteUSD += monto;
    }
  }

  const { data: profitData, error: errP } = await supabase.rpc("profit_por_cliente", {
    _fecha_desde: undefined,
    _fecha_hasta: undefined,
    _modo: undefined,
  });
  if (errP) throw errP;

  const clienteProfit = (profitData as ProfitRow[] | null ?? []).find(
    (r) => r.cliente_id === clienteId,
  );
  const ventaUSD = clienteProfit?.venta_usd ?? 0;
  const costoUSD = clienteProfit?.costo_usd ?? 0;
  const profitUSD = ventaUSD - costoUSD;

  return { facturadoUSD, pendienteUSD, profitUSD };
}
