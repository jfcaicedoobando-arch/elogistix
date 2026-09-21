/**
 * Política PURA del borrador de nota de crédito (sin React, Query, toast ni
 * Supabase): valores por omisión, derivados/validación y construcción del
 * input de creación.
 *
 * Reglas fiscales conservadas tal cual:
 * - El IVA NUNCA se infiere: un renglón sin tratamiento representable bloquea.
 * - Uso del CFDI fijo en G02; la forma de pago la sugiere `sugerirFormaPagoNC`.
 * - TC: MXN = 1; cualquier otra moneda exige un TC finito > 0 (FIX-11).
 */
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import type {
  ConceptoNotaCredito,
  CrearNotaCreditoInput,
} from "@/features/facturacion/services/notasCredito";
import { USO_CFDI_NC } from "@/features/facturacion/utils/notaCreditoSugerencias";
import { calcularTotalesNC, type TotalesNC } from "@/features/facturacion/utils/notaCreditoTotales";
import { lineaIndeterminadaNC } from "@/features/facturacion/utils/impuestosNotaCredito";

type Moneda = Tables<"factura_notas_credito">["moneda"];
type Motivo = Tables<"factura_notas_credito">["motivo"];

const CLAVE_SAT_DEFAULT = "84111506";
const CLAVE_UNIDAD_DEFAULT = "E48";

/** Mensaje interno (jerga `LC_*`) del guard de tipo de cambio. */
export const MSG_TC_NO_DISPONIBLE =
  "LC_TC_NO_DISPONIBLE: la factura no tiene tipo de cambio válido; refresca antes de emitir la NC.";

export function makeConcepto(): ConceptoNotaCredito {
  return {
    descripcion: "",
    cantidad: 1,
    precio_unitario: 0,
    clave_sat: CLAVE_SAT_DEFAULT,
    clave_unidad: CLAVE_UNIDAD_DEFAULT,
    unidad: "Unidad de servicio",
    // P1-IVA: un renglón nuevo NACE SIN tratamiento fiscal. La factura original
    // puede ser exenta, a tasa 0, no objeto o al 8%: un 16% por omisión
    // acreditaría un impuesto que nunca se trasladó. El usuario lo elige.
    tasa_iva: null,
    tipo_iva: null,
    tasa_ret_isr: 0,
    tasa_ret_iva: 0,
    es_manual: true,
  };
}

/** Estado capturable del borrador. */
export interface DraftNC {
  fecha: string;
  motivo: Motivo;
  descripcion: string;
  formaPago: string;
  conceptos: ConceptoNotaCredito[];
}

export function conceptosIniciales(sugeridos?: ConceptoNotaCredito[]): ConceptoNotaCredito[] {
  return sugeridos?.length ? sugeridos.map((c) => ({ ...c })) : [makeConcepto()];
}

/** Borrador limpio: se usa al montar y en CADA transición cerrado→abierto. */
export function draftInicialNC(params: {
  formaPago: string;
  conceptosSugeridos?: ConceptoNotaCredito[];
}): DraftNC {
  return {
    fecha: format(new Date(), "yyyy-MM-dd"),
    motivo: "Descuento",
    descripcion: "",
    formaPago: params.formaPago,
    conceptos: conceptosIniciales(params.conceptosSugeridos),
  };
}

export interface ContextoFacturaNC {
  saldoFactura: number;
  uuidFacturaOriginal: string | null;
}

export interface DerivadosNC {
  totales: TotalesNC;
  monto: number;
  saldoRestante: number;
  excedeSaldo: boolean;
  facturaLiquidada: boolean;
  sinUuid: boolean;
  conceptosValidos: boolean;
  tratamientoIndefinido: boolean;
  puedeGuardar: boolean;
  puedeTimbrar: boolean;
  faltantesGuardar: string[];
  faltantesTimbrar: string[];
  isDirty: boolean;
}

export function derivadosNC(draft: DraftNC, ctx: ContextoFacturaNC): DerivadosNC {
  // B-007: la NC refleja el total con IVA para que iguale el saldo original.
  const totales = calcularTotalesNC(draft.conceptos);
  const monto = totales.total;

  const excedeSaldo = monto > ctx.saldoFactura + 0.01;
  const facturaLiquidada = ctx.saldoFactura <= 0.01;
  const sinUuid = !ctx.uuidFacturaOriginal;
  const conceptosValidos =
    draft.conceptos.length > 0 &&
    draft.conceptos.every((c) => c.descripcion.trim() && c.cantidad > 0 && c.precio_unitario >= 0);
  // P1-IVA: un renglón sin tratamiento fiscal representable no se puede timbrar
  // (el CFDI acreditaría impuestos supuestos). Se bloquea con aviso, no se infiere.
  const tratamientoIndefinido = draft.conceptos.some(lineaIndeterminadaNC);
  const puedeGuardar =
    !!draft.descripcion.trim() && conceptosValidos && monto > 0 && !excedeSaldo &&
    !facturaLiquidada && !tratamientoIndefinido;

  // YG-06: etiquetas de lo que falta para poder guardar/timbrar la NC.
  const faltantesGuardar = [
    facturaLiquidada && "factura con saldo pendiente",
    !draft.descripcion.trim() && "descripción",
    !conceptosValidos && "conceptos completos (descripción, cantidad y precio)",
    monto <= 0 && "importe mayor a cero",
    excedeSaldo && "monto dentro del saldo de la factura",
    tratamientoIndefinido && "tratamiento fiscal de IVA definido en cada concepto",
  ].filter((x): x is string => !!x);

  return {
    totales,
    monto,
    saldoRestante: ctx.saldoFactura - monto,
    excedeSaldo,
    facturaLiquidada,
    sinUuid,
    conceptosValidos,
    tratamientoIndefinido,
    puedeGuardar,
    puedeTimbrar: puedeGuardar && !sinUuid,
    faltantesGuardar,
    faltantesTimbrar: sinUuid
      ? [...faltantesGuardar, "UUID fiscal de la factura original"]
      : faltantesGuardar,
    // YG-04: hay algo capturado que se perdería si se cierra el modal.
    isDirty:
      !!draft.descripcion.trim() ||
      draft.conceptos.some(
        (c) => c.descripcion.trim() !== "" || c.cantidad !== 1 || c.precio_unitario !== 0,
      ),
  };
}

/**
 * FIX-11: nunca sustituir TC ausente por 1 en monedas ≠ MXN — provoca cálculos
 * MXN silenciosamente erróneos.
 */
export function normalizarTipoCambioNC(moneda: Moneda, tipoCambio: number): number {
  const tc = moneda === "MXN" ? 1 : Number(tipoCambio);
  if (!Number.isFinite(tc) || tc <= 0) throw new Error(MSG_TC_NO_DISPONIBLE);
  return tc;
}

export function construirInputNC(params: {
  draft: DraftNC;
  facturaId: string;
  monedaFactura: Moneda;
  tipoCambioFactura: number;
  monto: number;
}): CrearNotaCreditoInput {
  const { draft } = params;
  return {
    factura_id: params.facturaId,
    motivo: draft.motivo,
    descripcion: draft.descripcion.trim(),
    monto: params.monto,
    moneda: params.monedaFactura,
    tipo_cambio: normalizarTipoCambioNC(params.monedaFactura, params.tipoCambioFactura),
    fecha_emision: draft.fecha,
    uso_cfdi: USO_CFDI_NC,
    forma_pago: draft.formaPago,
    conceptos: draft.conceptos,
  };
}
