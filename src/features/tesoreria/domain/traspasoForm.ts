/**
 * Dominio puro del formulario de traspaso entre cuentas propias: estado
 * inicial, validación y ayudantes de idempotencia.
 *
 * Extraído de `useTraspasoForm.ts` para respetar el límite de 200 líneas por
 * archivo (Power of 10). Sin React ni red.
 */
import type { Tables } from "@/integrations/supabase/types";
import { multiplyMoney, roundMoney } from "@/lib/financial/financialUtils";
import { parInvolucraMxn, validarTcMxn } from "@/lib/financial/tcBanda";
import { hoyMx } from "@/lib/date/mx";
import type { MonedaTc } from "@/features/tesoreria/domain/tcPar";
import { multiplicadorOrigenDestino } from "@/features/tesoreria/domain/tcPar";
import { fechaMinimaTraspaso, validarFechaTraspaso } from "./traspasoFecha";

type Cuenta = Tables<"cuentas_bancarias">;
export type ParTcLocal = { base: MonedaTc; quote: MonedaTc } | null;

// BL-14: "hoy" siempre en zona de negocio CDMX, no en la TZ del navegador.
export const hoyIso = () => hoyMx();

export interface TraspasoFormState {
  origenId: string;
  destinoId: string;
  fecha: string;
  montoOrigen: number;
  /**
   * Cotización en convención mexicana: unidades de `quote` por 1 `base` del
   * par (p. ej. 18.42 MXN por 1 USD). NO es el multiplicador origen→destino.
   */
  tcQuote: number;
  comision: number;
  concepto: string;
  referencia: string;
}

export const ESTADO_INICIAL: TraspasoFormState = {
  origenId: "",
  destinoId: "",
  fecha: hoyIso(),
  montoOrigen: 0,
  // UIA-02: 0 = "sin capturar". Antes el default 1 posteaba conversiones
  // 1:1 silenciosas entre monedas distintas.
  tcQuote: 0,
  comision: 0,
  concepto: "",
  referencia: "",
};

/**
 * M-14: si el par incluye MXN, el T/C implícito en pesos por divisa debe caer
 * en banda (5–40). Atrapa dedazos tipo 1.84 o 184 pesos por dólar.
 */
function validarTcPar(par: ParTcLocal, tcQuote: number): string | null {
  if (!par || !parInvolucraMxn(par.base, par.quote) || tcQuote <= 0) return null;
  const mxnPorDivisa = par.quote === "MXN" ? tcQuote : 1 / tcQuote;
  return validarTcMxn(roundMoney(mxnPorDivisa));
}

/** Validación pura del traspaso. Extraída del `useMemo` (complejidad ≤16). */
export function validarImportesTraspaso(montoOrigen: number, comision: number): string | null {
  if (!Number.isFinite(montoOrigen) || montoOrigen <= 0) return "El monto debe ser mayor a cero; no se admiten importes negativos.";
  if (!Number.isFinite(comision) || comision < 0) return "La comisión no puede ser negativa.";
  return null;
}

/** Mismo abono a centavos que ROUND(monto_origen * tipo_cambio, 2) en la RPC. */
export function calcularMontoDestinoTraspaso(montoOrigen: number, tipoCambio: number | null): number {
  if (!Number.isFinite(montoOrigen) || montoOrigen <= 0 ||
    tipoCambio === null || !Number.isFinite(tipoCambio) || tipoCambio <= 0) return 0;
  return multiplyMoney(montoOrigen, tipoCambio);
}

export function validarMontoDestinoTraspaso(montoOrigen: number, tipoCambio: number): string | null {
  const montoDestino = calcularMontoDestinoTraspaso(montoOrigen, tipoCambio);
  if (!Number.isFinite(montoDestino)) return "El importe de destino no es válido. Revisa el monto y el tipo de cambio.";
  if (montoDestino <= 0) {
    return "El importe de destino queda en 0.00 después del redondeo. Aumenta el monto para abonar al menos 0.01 en la cuenta destino.";
  }
  return null;
}

export function validarTraspaso(
  state: TraspasoFormState,
  origen: Cuenta | undefined,
  destino: Cuenta | undefined,
  mismoMoneda: boolean,
  par: ParTcLocal,
): string | null {
  if (!state.origenId || !state.destinoId) return "Selecciona ambas cuentas.";
  if (state.origenId === state.destinoId) return "La cuenta origen y destino deben ser distintas.";
  const errorImportes = validarImportesTraspaso(state.montoOrigen, state.comision);
  if (errorImportes) return errorImportes;
  if (!origen?.activa || !destino?.activa) return "Ambas cuentas deben estar activas.";
  const errorFecha = validarFechaTraspaso(state.fecha, fechaMinimaTraspaso(origen, destino));
  if (errorFecha) return errorFecha;
  if (mismoMoneda) return validarMontoDestinoTraspaso(state.montoOrigen, 1);
  if (!Number.isFinite(state.tcQuote) || state.tcQuote <= 0) {
    return "Captura el tipo de cambio para cuentas de distinta moneda.";
  }
  const errorTc = validarTcPar(par, state.tcQuote);
  if (errorTc) return errorTc;
  const factor = multiplicadorOrigenDestino(par, origen.moneda, state.tcQuote);
  if (factor === null) return "Captura un tipo de cambio válido para las monedas de ambas cuentas.";
  return validarMontoDestinoTraspaso(state.montoOrigen, factor);
}

/**
 * Convierte el TC DOF (base MXN) a la cotización del par en convención
 * mexicana: unidades de `quote` por 1 `base`.
 */
export function sugerirTcQuote(
  tc: { usdMxn: number; eurMxn: number | null } | null | undefined,
  par: ParTcLocal,
): number | null {
  if (!tc || !par) return null;
  const aMxn = (m: MonedaTc): number | null =>
    m === "MXN" ? 1 : m === "USD" ? tc.usdMxn : tc.eurMxn;
  const base = aMxn(par.base);
  const quote = aMxn(par.quote);
  if (!base || !quote || base <= 0 || quote <= 0) return null;
  return Math.round((base / quote) * 10000) / 10000;
}

/**
 * YG-04: ¿el traspaso tiene captura que se perdería al cerrar el diálogo?
 *
 * MNY P2.4: la fecha cuenta como captura sólo si cambió respecto a la que traía
 * el diálogo al abrirse (el default "hoy" no lo marca sucio).
 */
export function traspasoSucio(state: TraspasoFormState, fechaInicial?: string): boolean {
  const señales = [
    !!state.origenId, !!state.destinoId, state.montoOrigen !== 0,
    state.comision !== 0, state.concepto.trim() !== "", state.referencia.trim() !== "",
    !!fechaInicial && state.fecha !== fechaInicial,
  ];
  return señales.some(Boolean);
}

/**
 * MNY: contenido normalizado del traspaso, usado como `scope` de la llave de
 * idempotencia. Reintentar el mismo traspaso reusa la llave; cambiar cuentas,
 * fecha, importes o concepto genera otra para que el backend no confirme el
 * traspaso anterior.
 */
export function conceptoTraspaso(state: TraspasoFormState): string {
  return state.concepto.trim() || "Traspaso entre cuentas propias";
}

export function partesTraspaso(
  state: TraspasoFormState,
  tipoCambio: number,
): Array<string | number> {
  return [
    state.origenId, state.destinoId, state.fecha, state.montoOrigen,
    tipoCambio, state.comision, conceptoTraspaso(state), state.referencia.trim(),
  ];
}
