/**
 * Deriva los flags booleanos que gobiernan la UI del detalle de factura.
 * Se extrae como helper puro para reducir la complejidad ciclomática del
 * route `FacturaDetalle` (Power of 10 #4) y hacerlos testeables.
 */

/**
 * Fecha a partir de la cual el sistema tuvo capacidad de timbrar CFDI.
 * Facturas creadas antes de este corte fueron timbradas directamente en
 * el portal del SAT, por lo que no se puede/debe re-timbrar desde la app.
 */
export const FECHA_INICIO_TIMBRADO_SISTEMA = "2026-07-01T00:00:00Z";

export interface FacturaFlagsInput {
  estado?: string | null;
  facturapi_id?: string | null;
  uuid_fiscal?: string | null;
  fecha_emision?: string | null;
  sustituida_por?: string | null;
  /**
   * Estado de la factura sustituta apuntada por `sustituida_por`. Si está
   * `Cancelada` o `Sustituida` significa que la sustitución ya no es vigente
   * y la factura original vuelve a estar disponible para cancelar/sustituir.
   */
  sustituida_por_ref?: { estado?: string | null } | null;
  /** Estado del trámite de cancelación (none | pending | verifying | verified). */
  cancellation_status?: string | null;
}

export interface FacturaFlagsContext {
  /** Saldo pendiente en la moneda de la factura. */
  saldo?: number;
  /** Cuántos pagos aún tienen REP pendiente o con error. */
  pagosRepPendientes?: number;
}

export interface FacturaFlags {
  sinTimbrar: boolean;
  esBorrador: boolean;
  puedeEditarBorrador: boolean;
  puedeEliminarBorrador: boolean;
  /**
   * True sólo si la factura aún no está timbrada Y fue creada después de
   * que el sistema tuvo capacidad de timbrar. Las facturas legacy
   * (creadas antes del corte) se timbraron fuera del sistema.
   */
  puedeTimbrarDesdeSistema: boolean;
  /** Timbrada, vigente ("Emitida") y con permiso de edición. */
  puedeCancelarCfdi: boolean;
  /** Igual que cancelar: sólo se puede sustituir una CFDI vigente. */
  puedeSustituirCfdi: boolean;
  /** Timbrada, no cancelada y con saldo > 0. Habilita "Registrar pago" arriba. */
  puedeRegistrarPago: boolean;
  /** Existe al menos 1 pago con estado_rep Pendiente/Error. */
  repPendiente: boolean;
  /** Timbrada y no cancelada/sustituida. */
  estaCancelada: boolean;
}

const EMPTY_FLAGS: FacturaFlags = {
  sinTimbrar: false,
  esBorrador: false,
  puedeEditarBorrador: false,
  puedeEliminarBorrador: false,
  puedeTimbrarDesdeSistema: false,
  puedeCancelarCfdi: false,
  puedeSustituirCfdi: false,
  puedeRegistrarPago: false,
  repPendiente: false,
  estaCancelada: false,
};

function isEstadoCanceladoOSustituido(estado: string | null | undefined): boolean {
  return estado === "Cancelada" || estado === "Sustituida";
}

function isSustitutaViva(f: FacturaFlagsInput): boolean {
  if (!f.sustituida_por) return false;
  return !isEstadoCanceladoOSustituido(f.sustituida_por_ref?.estado);
}

function deriveActionFlags(
  f: FacturaFlagsInput,
  canEdit: boolean,
  ctx: FacturaFlagsContext,
  canRegistrarCobro: boolean,
): FacturaFlags {
  const sinTimbrar = !f.uuid_fiscal;
  const esBorrador = f.estado === "Borrador" && !f.facturapi_id;
  const puedeEditarBorrador = esBorrador && canEdit;
  const estaCancelada = isEstadoCanceladoOSustituido(f.estado);
  const timbradaVigente = !sinTimbrar && f.estado === "Emitida";
  const puedeCambiarCfdi = timbradaVigente && canEdit && !isSustitutaViva(f);
  const saldo = ctx.saldo ?? 0;
  const vigenteCobrable = f.estado === "Emitida" && !estaCancelada;
  return {
    sinTimbrar,
    esBorrador,
    puedeEditarBorrador,
    puedeEliminarBorrador: puedeEditarBorrador,
    puedeTimbrarDesdeSistema: sinTimbrar && esCreadaConCapacidadTimbrado(f.fecha_emision),
    puedeCancelarCfdi: puedeCambiarCfdi,
    puedeSustituirCfdi: puedeCambiarCfdi,
    puedeRegistrarPago: vigenteCobrable && canRegistrarCobro && saldo > 0.01,
    repPendiente: (ctx.pagosRepPendientes ?? 0) > 0,
    estaCancelada,
  };
}

export function deriveFacturaFlags(
  factura: FacturaFlagsInput | null | undefined,
  canEdit: boolean,
  ctx: FacturaFlagsContext = {},
  canRegistrarCobro: boolean = canEdit,
): FacturaFlags {
  if (!factura) return EMPTY_FLAGS;
  return deriveActionFlags(factura, canEdit, ctx, canRegistrarCobro);
}


/**
 * Helper reutilizable por listas/tablas donde no se necesita el resto de
 * flags: indica si una factura fue emitida dentro de la ventana en que el
 * sistema puede timbrar (post 01/07/2026). Se usa la fecha de emisión
 * porque es la que el usuario ve y el campo disponible en el listado.
 */
export function esCreadaConCapacidadTimbrado(
  fechaEmision: string | null | undefined,
): boolean {
  if (!fechaEmision) return false;
  return fechaEmision >= FECHA_INICIO_TIMBRADO_SISTEMA;
}
