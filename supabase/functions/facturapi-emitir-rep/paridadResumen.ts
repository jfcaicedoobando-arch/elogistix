/**
 * P2 · Auditoría fiscal — contrato de PARIDAD entre el cálculo local del REP
 * (parcialidad, saldo anterior, monto e impuestos prorrateados) y el resumen de
 * pago que publica Facturapi (`invoices.paymentSummary`).
 *
 * Docs: https://docs.facturapi.io/docs/guides/invoices/pago/
 *
 * El cálculo local NO se reemplaza a ciegas: nuestras notas de crédito y el
 * historial de pagos viven en el ERP y pueden diferir del saldo que el proveedor
 * conoce. Esta función es el juez: si hay divergencia, el timbrado debe
 * detenerse con un error recuperable en vez de sellar saldos o impuestos
 * incorrectos.
 */

export interface ImpuestoRep {
  type: "IVA" | "ISR";
  rate: number;
  base: number;
  withholding?: boolean;
}

export interface CalculoRep {
  installment: number;
  last_balance: number;
  amount: number;
  taxes: ImpuestoRep[];
}

/** Forma (parcial) del resumen del proveedor; todo es opcional a propósito. */
export interface ResumenPagoSdk {
  installment?: number | null;
  last_balance?: number | null;
  amount?: number | null;
  taxes?: ImpuestoRep[] | null;
}

export const MSG_REP_PARIDAD_RESUMEN =
  "El saldo o los impuestos que calculamos para el complemento de pago no coinciden con el " +
  "resumen del proveedor de timbrado. No se timbra para no sellar un saldo equivocado: revisa " +
  "los pagos y notas de crédito aplicados a la factura y vuelve a intentarlo.";

/** Tolerancia monetaria: un centavo (mismo redondeo del payload). */
const TOLERANCIA = 0.01;

function difiere(a: number, b: number, tolerancia: number): boolean {
  return Math.abs(a - b) > tolerancia;
}

function claveImpuesto(t: ImpuestoRep): string {
  return `${t.type}|${t.rate}|${t.withholding === true ? "ret" : "tras"}`;
}

function etiquetaImpuesto(t: ImpuestoRep): string {
  const tipo = t.withholding === true ? "retenido" : "trasladado";
  return `${t.type} ${tipo} ${(t.rate * 100).toFixed(2)}%`;
}

function divergenciasImpuestos(
  local: ImpuestoRep[],
  remoto: ImpuestoRep[],
  tolerancia: number,
): string[] {
  const detalles: string[] = [];
  const porClaveRemoto = new Map(remoto.map((t) => [claveImpuesto(t), t]));
  for (const t of local) {
    const par = porClaveRemoto.get(claveImpuesto(t));
    if (!par) {
      detalles.push(`${etiquetaImpuesto(t)} no aparece en el resumen del proveedor`);
      continue;
    }
    if (difiere(Number(t.base), Number(par.base), tolerancia)) {
      detalles.push(
        `Base de ${etiquetaImpuesto(t)}: local ${Number(t.base).toFixed(2)} vs proveedor ${Number(par.base).toFixed(2)}`,
      );
    }
    porClaveRemoto.delete(claveImpuesto(t));
  }
  for (const t of porClaveRemoto.values()) {
    detalles.push(`El resumen del proveedor declara ${etiquetaImpuesto(t)} y nosotros no`);
  }
  return detalles;
}

/**
 * Lista de divergencias (vacía = paridad). Los campos ausentes del resumen NO
 * se inventan: simplemente no se comparan.
 */
export function divergenciasResumenPago(
  local: CalculoRep,
  resumen: ResumenPagoSdk | null | undefined,
  tolerancia: number = TOLERANCIA,
): string[] {
  if (!resumen) return [];
  const detalles: string[] = [];
  if (resumen.installment != null && Number(resumen.installment) !== local.installment) {
    detalles.push(`Parcialidad: local ${local.installment} vs proveedor ${Number(resumen.installment)}`);
  }
  if (resumen.last_balance != null && difiere(local.last_balance, Number(resumen.last_balance), tolerancia)) {
    detalles.push(
      `Saldo anterior: local ${local.last_balance.toFixed(2)} vs proveedor ${Number(resumen.last_balance).toFixed(2)}`,
    );
  }
  if (resumen.amount != null && difiere(local.amount, Number(resumen.amount), tolerancia)) {
    detalles.push(`Importe pagado: local ${local.amount.toFixed(2)} vs proveedor ${Number(resumen.amount).toFixed(2)}`);
  }
  if (resumen.taxes != null) {
    detalles.push(...divergenciasImpuestos(local.taxes, resumen.taxes, tolerancia));
  }
  return detalles;
}
