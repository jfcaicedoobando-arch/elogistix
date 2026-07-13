/**
 * Agregados puros para el módulo Estado de Cuenta.
 * Sin I/O — testeable de forma aislada.
 */
import { sumarMontos } from "@/lib/financial/financialUtils";
import type { FacturaEstadoCuenta } from "./estadoCuenta";

export interface KpiPorMoneda {
  mxn: number;
  usd: number;
}

export interface KpisEstadoCuenta {
  adeudado: KpiPorMoneda;
  vencido: KpiPorMoneda;
  aFavor: KpiPorMoneda;
  facturasVencidas: number;
  facturasAdeudadas: number;
}

function bucket(rows: FacturaEstadoCuenta[], predicate: (f: FacturaEstadoCuenta) => boolean) {
  const mxn: number[] = [];
  const usd: number[] = [];
  for (const f of rows) {
    if (!predicate(f)) continue;
    if (f.moneda === "MXN") mxn.push(f.saldo);
    else if (f.moneda === "USD") usd.push(f.saldo);
  }
  return { mxn: sumarMontos(mxn), usd: sumarMontos(usd) };
}

export function calcularKpisEstadoCuenta(rows: FacturaEstadoCuenta[]): KpisEstadoCuenta {
  const adeudado = bucket(rows, (f) => f.saldo > 0);
  const vencido = bucket(rows, (f) => f.saldo > 0 && f.estatus_cobranza === "Vencida");

  // Saldo a favor = suma de anticipos (monto_no_aplicado en pagos).
  const anticiposMxn: number[] = [];
  const anticiposUsd: number[] = [];
  for (const f of rows) {
    for (const p of f.pagos) {
      if (p.monto_no_aplicado <= 0) continue;
      if (f.moneda === "MXN") anticiposMxn.push(p.monto_no_aplicado);
      else if (f.moneda === "USD") anticiposUsd.push(p.monto_no_aplicado);
    }
  }

  const facturasVencidas = rows.filter(
    (f) => f.saldo > 0 && f.estatus_cobranza === "Vencida",
  ).length;
  const facturasAdeudadas = rows.filter((f) => f.saldo > 0).length;

  return {
    adeudado,
    vencido,
    aFavor: {
      mxn: sumarMontos(anticiposMxn),
      usd: sumarMontos(anticiposUsd),
    },
    facturasVencidas,
    facturasAdeudadas,
  };
}
