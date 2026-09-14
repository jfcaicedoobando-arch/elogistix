/**
 * Cálculo puro del resumen visual de un traspaso entre cuentas propias.
 *
 * No sustituye a la RPC `registrar_traspaso_bancario`: sólo describe, con los
 * mismos números que ya calcula `useTraspasoForm`, qué sale de la cuenta
 * origen y qué llega a la cuenta destino.
 */
import { roundMoney } from "@/lib/financial/financialUtils";

export interface ResumenTraspasoInput {
  montoOrigen: number;
  /** Comisión bancaria, expresada en la moneda de la cuenta origen. */
  comision: number;
  /** Abono en la cuenta destino, ya convertido y redondeado. */
  montoDestino: number;
}

export interface ResumenTraspaso {
  montoOrigen: number;
  comision: number;
  /** Monto + comisión: el cargo total en la cuenta origen. */
  totalCargoOrigen: number;
  montoDestino: number;
}

export function resumenTraspaso({ montoOrigen, comision, montoDestino }: ResumenTraspasoInput): ResumenTraspaso {
  const monto = montoOrigen > 0 ? roundMoney(montoOrigen) : 0;
  const com = comision > 0 ? roundMoney(comision) : 0;
  return {
    montoOrigen: monto,
    comision: com,
    totalCargoOrigen: roundMoney(monto + com),
    montoDestino: montoDestino > 0 ? roundMoney(montoDestino) : 0,
  };
}
