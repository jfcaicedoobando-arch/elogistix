/**
 * Finanzas del cliente: facturación acumulada, pendiente y utilidad.
 *
 * Ola 6 · M1 (auditoría 3): antes se sumaban los totales de todas las facturas
 * como si fueran USD (100 USD + 100 MXN = 200 "USD"). Ahora todo se expresa en
 * MXN convirtiendo cada factura con SU tipo de cambio (canon `aMxn`), y lo que
 * no se puede convertir por falta de TC se cuenta aparte en vez de sumarse mal.
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchEstadoCuenta, type FacturaEstadoCuenta } from "@/features/facturacion/services";
import { aMxn } from "@/lib/financial/convertir";
import { sumarMontos } from "@/lib/financial/financialUtils";

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

/** Suma facturado/pendiente en MXN y cuenta las facturas sin TC confiable. */
function totalizarFacturas(filas: readonly FacturaEstadoCuenta[]) {
  const facturado: number[] = [];
  const pendiente: number[] = [];
  let facturasSinTc = 0;
  for (const f of filas) {
    const conv = aMxn(f.total ?? 0, f.moneda, f.tipo_cambio);
    if (!conv.completo) {
      facturasSinTc += 1;
      continue;
    }
    facturado.push(conv.monto);
    // El saldo ya descuenta pagos vigentes y NC con el mismo canon que tabla/CSV.
    pendiente.push(aMxn(f.saldo, f.moneda, f.tipo_cambio).monto);
  }
  return {
    facturadoMXN: sumarMontos(facturado),
    pendienteMXN: sumarMontos(pendiente),
    facturasSinTc,
  };
}

export async function fetchClienteFinancials(clienteId: string): Promise<ClienteFinancials> {
  // Una sola lectura con pagos/NC: comparte estados vivos, saldo neto y guarda
  // anti-truncamiento con el estado de cuenta en pantalla y sus exportaciones.
  const facturas = await fetchEstadoCuenta({ clienteIds: [clienteId] });
  const { facturadoMXN, pendienteMXN, facturasSinTc } = totalizarFacturas(facturas);

  // Perf: la RPC se filtra por cliente para no recalcular toda la organización
  // (antes provocaba statement timeout 57014 en la ficha del cliente).
  const { data: profitData, error: errP } = await supabase.rpc("profit_por_cliente", {
    _fecha_desde: undefined,
    _fecha_hasta: undefined,
    _modo: undefined,
    _cliente_id: clienteId,
  });
  if (errP) throw errP;

  const filas = (profitData as ProfitRow[] | null) ?? [];
  const fila = filas.find((r) => r.cliente_id === clienteId) ?? filas[0];

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
