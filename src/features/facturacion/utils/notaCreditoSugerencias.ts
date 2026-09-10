/**
 * Helpers puros para el modal de nueva nota de crédito.
 *
 * Reglas SAT aplicadas (Anexo 20, guía de llenado):
 * - Uso del CFDI en un egreso siempre es G02 (devoluciones, descuentos o
 *   bonificaciones); no se ofrece elegir otra clave.
 * - Método de pago siempre PUE: los egresos no admiten parcialidades.
 * - Forma de pago: si la factura origen NO está cobrada, no hay flujo de
 *   dinero y se usa 15 (condonación); si ya se cobró, se replica la forma con
 *   la que entró el dinero (o 03 si no se conoce).
 */
import { roundMoney, TASA_IVA } from "@/lib/financial/financialUtils";
import type { ConceptoNotaCredito } from "@/features/facturacion/services/notasCredito";

/** Única clave de uso de CFDI válida para notas de crédito. */
export const USO_CFDI_NC = "G02";

/** Forma de pago cuando la factura origen no tiene cobros vigentes. */
export const FORMA_PAGO_SIN_COBRO = "15";
/** Respaldo cuando la factura sí se cobró pero no sabemos con qué forma. */
export const FORMA_PAGO_COBRADA_DEFAULT = "03";

export interface SugerenciaFormaPago {
  formaPago: string;
  /** Explicación en español para mostrar bajo el campo. */
  explicacion: string;
}

/**
 * Propone la forma de pago de la NC según el estado de cobro de la factura.
 * `formaPagoCobro` debe venir del cobro vigente más reciente (los cobros con
 * REP cancelado no cuentan: el dinero se reversó).
 */
export function sugerirFormaPagoNC(params: {
  facturaCobrada: boolean;
  formaPagoCobro?: string | null;
}): SugerenciaFormaPago {
  if (!params.facturaCobrada) {
    return {
      formaPago: FORMA_PAGO_SIN_COBRO,
      explicacion:
        "La factura no tiene cobros: no hay flujo de dinero, se extingue el saldo (15 Condonación).",
    };
  }
  const forma = params.formaPagoCobro?.trim() || FORMA_PAGO_COBRADA_DEFAULT;
  return {
    formaPago: forma,
    explicacion:
      "La factura ya está cobrada: se replica la forma de pago con la que entró el dinero.",
  };
}

const DESCRIPCION_SALDO = "Nota de crédito por saldo pendiente de la factura";

/**
 * Un solo concepto cuyo total con IVA iguala el saldo pendiente.
 * El precio se calcula desmontando el IVA para que `precio * (1 + tasa)`
 * regrese al saldo capturado.
 */
export function conceptoPorSaldo(
  saldo: number,
  base: ConceptoNotaCredito,
  tasa: number = TASA_IVA,
): ConceptoNotaCredito {
  const tasaSegura = Number.isFinite(tasa) && tasa >= 0 ? tasa : 0;
  const saldoSeguro = Number.isFinite(saldo) && saldo > 0 ? saldo : 0;
  return {
    ...base,
    descripcion: DESCRIPCION_SALDO,
    cantidad: 1,
    precio_unitario: roundMoney(saldoSeguro / (1 + tasaSegura)),
    tasa_iva: tasaSegura,
  };
}

/** Escala los precios de los conceptos a un porcentaje (10 => 10% del importe). */
export function aplicarPorcentaje(
  conceptos: ConceptoNotaCredito[],
  porcentaje: number,
): ConceptoNotaCredito[] {
  const pct = Number.isFinite(porcentaje) ? porcentaje : 0;
  const factor = Math.min(Math.max(pct, 0), 100) / 100;
  return conceptos.map((c) => ({
    ...c,
    precio_unitario: roundMoney(Number(c.precio_unitario ?? 0) * factor),
  }));
}

/** Copia sólo los conceptos marcados de la factura original. */
export function conceptosSeleccionados(
  sugeridos: ConceptoNotaCredito[],
  indices: number[],
): ConceptoNotaCredito[] {
  const set = new Set(indices);
  return sugeridos.filter((_, i) => set.has(i)).map((c) => ({ ...c }));
}
