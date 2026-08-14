/**
 * Reglas puras del asistente "Refacturar a otro receptor" (5 pasos).
 *
 * Espejo en UI de los candados que ya aplica la base de datos
 * (`LC_REFACT_*`): aquí sólo se decide si el usuario puede avanzar y qué
 * explicación se le muestra, sin llamadas de red ni React.
 *
 * Los predicados fiscales viven en `refacturacionEstadoFiscal.ts` y se
 * re-exportan aquí para no romper los imports existentes.
 */
import {
  cancelacionOriginalEnTramite,
  cancelacionOriginalRechazada,
  facturaNuevaLista,
  originalFueraDeCirculacion,
  pagosConRepVivo,
  repsEnVerificacion,
  type FacturaRefacturacion,
  type PagoRefacturacion,
} from "@/features/facturacion/domain/refacturacionEstadoFiscal";

export {
  cancelacionOriginalEnTramite,
  cancelacionOriginalRechazada,
  facturaNuevaLista,
  originalFueraDeCirculacion,
  pagosConRepVivo,
  repsEnVerificacion,
  tieneRepVivo,
} from "@/features/facturacion/domain/refacturacionEstadoFiscal";
export type {
  FacturaRefacturacion,
  PagoRefacturacion,
} from "@/features/facturacion/domain/refacturacionEstadoFiscal";

export const PASOS_REFACTURACION = [
  "Diagnóstico",
  "Cancelar REP",
  "Nueva factura",
  "Cancelar original",
  "Reasignar pago",
] as const;

export const TOTAL_PASOS_REFACTURACION = PASOS_REFACTURACION.length;

export const AVISO_ORIGINAL_EN_VERIFICACION =
  "La cancelación del CFDI original está en verificación con el SAT. Puedes reasignar el pago porque el REP anterior ya está cancelado; la factura original quedará cancelada en automático cuando el SAT responda.";

export const AVISO_REP_EN_VERIFICACION =
  "La cancelación del REP está en verificación con el SAT. Puedes emitir la factura del nuevo receptor mientras tanto; el nuevo REP se timbra cuando el SAT libere la cancelación.";

export interface ContextoPasos {
  casoAbierto: boolean;
  clienteDestinoId: string | null;
  motivo: string;
  pagos: PagoRefacturacion[];
  facturaNueva: FacturaRefacturacion | null;
  original: FacturaRefacturacion | null;
  pagoSeleccionadoId: string | null;
  pagoYaReasignado: boolean;
  /** Datos fiscales faltantes del nuevo receptor (CFDI 4.0). */
  receptorPendientes?: string[];
  /** Hallazgos de `refacturacion_validar_consistencia` sobre la nueva factura. */
  consistenciaHallazgos?: string[];
  /** Motivo por el que el ordenante del depósito no es válido. */
  bloqueoOrdenante?: string | null;
  /** El rol del usuario no puede operar casos de refacturación (sólo consulta). */
  bloqueoPermiso?: string | null;
}

function bloqueoPaso1(ctx: ContextoPasos): string | null {
  if (ctx.casoAbierto) return null;
  if (!ctx.clienteDestinoId) return "Selecciona el cliente que debe recibir la factura.";
  if (!ctx.motivo.trim()) return "Describe el motivo de la refacturación.";
  const faltan = ctx.receptorPendientes ?? [];
  if (faltan.length > 0) {
    return `Completa los datos fiscales del receptor antes de abrir el caso: ${faltan.join(", ")}.`;
  }
  return null;
}

function bloqueoPaso2(ctx: ContextoPasos): string | null {
  const vivos = pagosConRepVivo(ctx.pagos);
  if (vivos.length === 0) return null;
  // Con solicitud en verificación el trámite ya está en manos del SAT: se puede
  // adelantar la emisión de la factura del nuevo receptor (sólo se avisa).
  const sinSolicitud = vivos.length - repsEnVerificacion(ctx.pagos).length;
  if (sinSolicitud === 0) return null;
  return sinSolicitud === 1
    ? "Cancela el complemento de pago (REP) del pago recibido antes de continuar."
    : `Cancela los ${sinSolicitud} complementos de pago (REP) vivos antes de continuar.`;
}

function bloqueoPaso3(ctx: ContextoPasos): string | null {
  if (!ctx.facturaNueva) return "Crea el borrador para el cliente destino.";
  if (!facturaNuevaLista(ctx.facturaNueva)) return "Timbra la nueva factura antes de continuar.";
  const hallazgos = ctx.consistenciaHallazgos ?? [];
  if (hallazgos.length > 0) return hallazgos[0];
  return null;
}

function bloqueoPaso4(ctx: ContextoPasos): string | null {
  if (originalFueraDeCirculacion(ctx.original)) return null;
  // Con la solicitud en trámite el REP anterior ya quedó cancelado: el pago
  // puede moverse aunque el SAT tarde en liberar la cancelación (sólo se avisa).
  if (cancelacionOriginalEnTramite(ctx.original)) return null;
  if (cancelacionOriginalRechazada(ctx.original)) {
    return "El SAT no aceptó la cancelación del CFDI original: vuelve a solicitarla antes de continuar.";
  }
  return "Solicita la cancelación del CFDI original antes de reasignar el pago.";
}

function bloqueoPaso5(ctx: ContextoPasos): string | null {
  if (ctx.pagoYaReasignado) return null;
  const vivos = pagosConRepVivo(ctx.pagos);
  if (vivos.length > 0) {
    return "El REP anterior sigue vigente ante el SAT: reasignar el pago ahora reportaría el mismo depósito dos veces. Espera la aceptación de la cancelación.";
  }
  if (!ctx.pagoSeleccionadoId) return "Selecciona el pago que debe moverse a la nueva factura.";
  if (!facturaNuevaLista(ctx.facturaNueva)) return "La nueva factura debe estar timbrada.";
  if (ctx.bloqueoOrdenante) return ctx.bloqueoOrdenante;
  return null;
}

const BLOQUEOS_POR_PASO: Record<number, (ctx: ContextoPasos) => string | null> = {
  1: bloqueoPaso1,
  2: bloqueoPaso2,
  3: bloqueoPaso3,
  4: bloqueoPaso4,
  5: bloqueoPaso5,
};

/**
 * Motivo por el que el paso indicado NO puede completarse todavía.
 * `null` significa "listo para continuar".
 */
export function bloqueoPaso(paso: number, ctx: ContextoPasos): string | null {
  if (ctx.bloqueoPermiso) return ctx.bloqueoPermiso;
  return BLOQUEOS_POR_PASO[paso]?.(ctx) ?? null;
}

/**
 * Aviso informativo del paso (no bloquea el avance). `null` = sin aviso.
 */
export function avisoPaso(paso: number, ctx: ContextoPasos): string | null {
  if (paso >= 2 && paso <= 4 && repsEnVerificacion(ctx.pagos).length > 0) {
    return AVISO_REP_EN_VERIFICACION;
  }
  if (paso >= 4 && cancelacionOriginalEnTramite(ctx.original)) {
    return AVISO_ORIGINAL_EN_VERIFICACION;
  }
  return null;
}

/** Texto de la acción principal por paso. */
export function etiquetaAccionPaso(paso: number, casoAbierto: boolean): string {
  if (paso === 1) return casoAbierto ? "Continuar" : "Abrir caso y continuar";
  if (paso === 5) return "Reasignar pago y finalizar";
  return "Continuar";
}
