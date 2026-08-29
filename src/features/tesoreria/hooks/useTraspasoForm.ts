/**
 * Estado y validación del formulario de traspaso entre cuentas propias.
 * Extraído para mantener el modal bajo 200 líneas (Power of 10).
 */
import { useEffect, useMemo, useState } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { roundMoney } from "@/lib/financial/financialUtils";
import { parInvolucraMxn, validarTcMxn } from "@/lib/financial/tcBanda";

import { hoyMx } from "@/lib/date/mx";
import { useTcDofPorFecha } from "@/features/catalogos/hooks/useTcDofPorFecha";
import { multiplicadorOrigenDestino, parTc, type MonedaTc } from "@/features/tesoreria/domain/tcPar";

type Cuenta = Tables<"cuentas_bancarias">;

// BL-14: "hoy" siempre en zona de negocio CDMX, no en la TZ del navegador.
const hoyIso = () => hoyMx();

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

const ESTADO_INICIAL: TraspasoFormState = {
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

export function useTraspasoForm(open: boolean, cuentas: Cuenta[]) {
  const [state, setState] = useState<TraspasoFormState>({ ...ESTADO_INICIAL, fecha: hoyIso() });

  useEffect(() => {
    if (!open) return;
    setState({ ...ESTADO_INICIAL, fecha: hoyIso() });
  }, [open]);

  const setField = <K extends keyof TraspasoFormState>(key: K, value: TraspasoFormState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const origen = useMemo(() => cuentas.find((c) => c.id === state.origenId), [cuentas, state.origenId]);
  const destino = useMemo(() => cuentas.find((c) => c.id === state.destinoId), [cuentas, state.destinoId]);
  const mismoMoneda = origen && destino && origen.moneda === destino.moneda;
  const par = useMemo(() => parTc(origen?.moneda, destino?.moneda), [origen?.moneda, destino?.moneda]);

  // BL-04: cuando las monedas difieren sugerimos el TC DOF de la fecha del
  // traspaso. Es sólo una sugerencia editable; si el usuario lo borra, la
  // validación vuelve a exigirlo (nunca se asume 1).
  const requiereTc = !!origen && !!destino && !mismoMoneda;
  const { data: tcDof } = useTcDofPorFecha(state.fecha, requiereTc);
  const tcSugerido = useMemo(() => sugerirTcQuote(tcDof, par), [tcDof, par]);

  useEffect(() => {
    if (!requiereTc || !tcSugerido) return;
    setState((prev) => (prev.tcQuote > 0 ? prev : { ...prev, tcQuote: tcSugerido }));
  }, [requiereTc, tcSugerido]);

  // Multiplicador que consume la RPC: monto_destino = monto_origen * factor.
  const factorOrigenDestino = useMemo(() => {
    if (mismoMoneda) return 1;
    return multiplicadorOrigenDestino(par, origen?.moneda, state.tcQuote);
  }, [mismoMoneda, par, origen?.moneda, state.tcQuote]);

  const montoDestino = useMemo(() => {
    if (!state.montoOrigen || state.montoOrigen <= 0) return 0;
    if (!factorOrigenDestino || factorOrigenDestino <= 0) return 0;
    // FE-07: la RPC redondea con ROUND(monto*tc, 2); el preview debe coincidir
    // centavo a centavo con el abono real.
    return roundMoney(state.montoOrigen * factorOrigenDestino);
  }, [state.montoOrigen, factorOrigenDestino]);

  const error = useMemo(() => {
    if (!state.origenId || !state.destinoId) return "Selecciona ambas cuentas.";
    if (state.origenId === state.destinoId) return "La cuenta origen y destino deben ser distintas.";
    if (!state.montoOrigen || state.montoOrigen <= 0) return "El monto debe ser mayor a cero.";
    if (!origen?.activa || !destino?.activa) return "Ambas cuentas deben estar activas.";
    // FE-07: fecha del traspaso obligatoria y nunca futura.
    if (!state.fecha) return "Captura la fecha del traspaso.";
    if (state.fecha > hoyIso()) return "La fecha del traspaso no puede ser futura.";
    if (!mismoMoneda && (!state.tcQuote || state.tcQuote <= 0)) {
      return "Captura el tipo de cambio para cuentas de distinta moneda.";
    }
    // M-14: si el par incluye MXN, el T/C implícito en pesos por divisa debe
    // caer en banda (5–40). Atrapa dedazos tipo 1.84 o 184 pesos por dólar.
    if (!mismoMoneda && par && parInvolucraMxn(par.base, par.quote) && state.tcQuote > 0) {
      const mxnPorDivisa = par.quote === "MXN" ? state.tcQuote : 1 / state.tcQuote;
      const fueraDeBanda = validarTcMxn(roundMoney(mxnPorDivisa));
      if (fueraDeBanda) return fueraDeBanda;
    }
    return null;
  }, [state, origen, destino, mismoMoneda, par]);


  return {
    state,
    setField,
    origen,
    destino,
    mismoMoneda,
    par,
    factorOrigenDestino,
    montoDestino,
    error,
    tcSugerido,
    fechaTcDof: tcDof?.fecha ?? null,
  };
}

type ParTcLocal = { base: MonedaTc; quote: MonedaTc } | null;

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
