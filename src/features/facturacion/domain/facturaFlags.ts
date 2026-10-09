import { tieneSaldoMonetario } from "@/lib/financial/toleranciaPago";
/**
 * Deriva los flags booleanos que gobiernan la UI del detalle de factura.
 * Se extrae como helper puro para reducir la complejidad ciclomática del
 * route `FacturaDetalle` (Power of 10 #4) y hacerlos testeables.
 */

import { esCreadaConCapacidadTimbrado } from "./facturaCapacidadTimbrado";

export {
  esCreadaConCapacidadTimbrado,
  FECHA_INICIO_TIMBRADO_SISTEMA,
} from "./facturaCapacidadTimbrado";

export interface FacturaFlagsInput {
  estado?: string | null;
  metodo_pago?: string | null;
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
  /** Pagos vigentes documentados; excluye REP cancelados y soft-delete. */
  pagosActivos?: number;
  /** Cuántos pagos aún tienen REP pendiente o con error. */
  pagosRepPendientes?: number;
  /**
   * P1: la lectura de pagos y/o notas de crédito aplicadas falló. El saldo
   * mostrado NO es confiable, así que las acciones que dependen de él
   * (registrar pago) deben deshabilitarse en vez de asumir saldo cero.
   */
  saldoError?: boolean;
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
  /** Timbrada y viva (aunque ya esté cobrada): admite abrir un caso de refacturación. */
  puedeRefacturarReceptor: boolean;
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
  puedeRefacturarReceptor: false,
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
/**
 * Estados de factura que admiten registrar un cobro. Espeja la guardia de BD
 * `assert_factura_viva_para_pago`, que sólo rechaza Cancelada/Sustituida/Borrador.
 */
const ESTADOS_COBRABLES = new Set(["Emitida", "Vencida", "Parcialmente pagada"]);

/** Estados sin pagos aplicados cuyo CFDI puede cancelarse/sustituirse ante el SAT. */
const ESTADOS_CFDI_VIGENTE = new Set(["Emitida", "Vencida"]);

function enTramiteCancelacion(f: FacturaFlagsInput): boolean {
  return f.cancellation_status === "pending" || f.cancellation_status === "verifying";
}

type FiscalFlags = Pick<
  FacturaFlags,
  "puedeCancelarCfdi" | "puedeSustituirCfdi" | "puedeRefacturarReceptor"
>;

/**
 * Acciones fiscales (cancelar / sustituir / refacturar receptor). Espejan las
 * guardias de BD: sólo CFDI timbrados y vivos, sin sustituta viva ni trámite
 * de cancelación en curso.
 */
function deriveFiscalFlags(
  f: FacturaFlagsInput,
  canEdit: boolean,
  sinTimbrar: boolean,
  estaCancelada: boolean,
): FiscalFlags {
  // "Vencida" sólo indica plazo de cobro vencido; el CFDI sigue vigente ante el SAT.
  const timbradaVigente = !sinTimbrar && ESTADOS_CFDI_VIGENTE.has(f.estado ?? "");
  const sinSustitutaViva = !isSustitutaViva(f);
  // v13.589.5: refacturar sólo exige CFDI timbrado y vivo (espejo de
  // `abrir_caso_refacturacion`), por eso no reusa `puedeSustituirCfdi`.
  const timbradaViva = !sinTimbrar && !estaCancelada && f.estado !== "Borrador";
  const sinTramiteCancelacion = !enTramiteCancelacion(f);
  return {
    puedeCancelarCfdi: timbradaVigente && canEdit && sinTramiteCancelacion,
    // Alineado con cancelar/refacturar: no se ofrece "Sustituir CFDI" mientras
    // haya una solicitud de cancelación viva (pending/verifying) ante FacturApi.
    puedeSustituirCfdi:
      timbradaVigente && canEdit && sinSustitutaViva && sinTramiteCancelacion,
    // Ola 14 · R5FE-01: refacturar tampoco se ofrece con cancelación en
    // trámite (pending/verifying), alineado con cancelar y registrar pago.
    // La RPC `abrir_caso_refacturacion` sigue siendo la autoridad final.
    puedeRefacturarReceptor:
      timbradaViva && canEdit && sinSustitutaViva && sinTramiteCancelacion,
  };
}

function puedeCobrarse(
  f: FacturaFlagsInput,
  ctx: FacturaFlagsContext,
  canRegistrarCobro: boolean,
  estaCancelada: boolean,
): boolean {
  // v13.547.0: "Vencida"/"Parcialmente pagada" también admiten cobro (espejo de
  // assert_factura_viva_para_pago).
  // v13.592.0: una factura con cancelación en trámite ante el SAT (pending/
  // verifying) NO admite cobros — espejo del candado LC_FACTURA_EN_CANCELACION.
  // P1: si la lectura de pagos/NC falló, el saldo no es confiable — fail-closed.
  if (ctx.saldoError) return false;
  // Un PUE previo se revisa, nunca se completa con una segunda exhibición.
  if (f.metodo_pago === "PUE" && (ctx.pagosActivos ?? 0) > 0) return false;
  // No reabrir Pagada histórica sin pagos documentados.
  const estadoCobrable = ESTADOS_COBRABLES.has(f.estado ?? "") ||
    (f.estado === "Pagada" && (ctx.pagosActivos ?? 0) > 0);
  const vigenteCobrable =
    estadoCobrable && !estaCancelada && !enTramiteCancelacion(f);
  return vigenteCobrable && canRegistrarCobro && tieneSaldoMonetario(ctx.saldo ?? 0);
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

  return {
    sinTimbrar,
    esBorrador,
    puedeEditarBorrador,
    puedeEliminarBorrador: puedeEditarBorrador,
    puedeTimbrarDesdeSistema: sinTimbrar && esCreadaConCapacidadTimbrado(f.fecha_emision),
    ...deriveFiscalFlags(f, canEdit, sinTimbrar, estaCancelada),
    puedeRegistrarPago: puedeCobrarse(f, ctx, canRegistrarCobro, estaCancelada),
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
