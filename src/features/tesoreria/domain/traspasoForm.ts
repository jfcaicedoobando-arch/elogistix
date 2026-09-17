/**
 * Dominio puro del formulario de traspaso entre cuentas propias: estado
 * inicial, validación y ayudantes de idempotencia.
 *
 * Extraído de `useTraspasoForm.ts` para respetar el límite de 200 líneas por
 * archivo (Power of 10). Sin React ni red.
 */
import type { Tables } from "@/integrations/supabase/types";
import { roundMoney } from "@/lib/financial/financialUtils";
import { parInvolucraMxn, validarTcMxn } from "@/lib/financial/tcBanda";
import { hoyMx } from "@/lib/date/mx";
import type { MonedaTc } from "@/features/tesoreria/domain/tcPar";

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
export function validarTraspaso(
  state: TraspasoFormState,
  origen: Cuenta | undefined,
  destino: Cuenta | undefined,
  mismoMoneda: boolean,
  par: ParTcLocal,
): string | null {
  if (!state.origenId || !state.destinoId) return "Selecciona ambas cuentas.";
  if (state.origenId === state.destinoId) return "La cuenta origen y destino deben ser distintas.";
  if (!state.montoOrigen || state.montoOrigen <= 0) return "El monto debe ser mayor a cero.";
  if (!origen?.activa || !destino?.activa) return "Ambas cuentas deben estar activas.";
  // FE-07: fecha del traspaso obligatoria y nunca futura.
  if (!state.fecha) return "Captura la fecha del traspaso.";
  if (state.fecha > hoyIso()) return "La fecha del traspaso no puede ser futura.";
  if (mismoMoneda) return null;
  if (!state.tcQuote || state.tcQuote <= 0) {
    return "Captura el tipo de cambio para cuentas de distinta moneda.";
  }
  return validarTcPar(par, state.tcQuote);
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
    !!state.origenId, !!state.destinoId, state.montoOrigen > 0,
    state.comision > 0, state.concepto.trim() !== "", state.referencia.trim() !== "",
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
