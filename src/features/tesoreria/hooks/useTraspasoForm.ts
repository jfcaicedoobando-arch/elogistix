/**
 * Estado y validación del formulario de traspaso entre cuentas propias.
 * Extraído para mantener el modal bajo 200 líneas (Power of 10).
 */
import { useEffect, useMemo, useState } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { roundMoney } from "@/lib/financial/financialUtils";
import { hoyMx } from "@/lib/date/mx";
import { useTcDofPorFecha } from "@/features/catalogos/hooks/useTcDofPorFecha";

type Cuenta = Tables<"cuentas_bancarias">;

// BL-14: "hoy" siempre en zona de negocio CDMX, no en la TZ del navegador.
const hoyIso = () => hoyMx();

export interface TraspasoFormState {
  origenId: string;
  destinoId: string;
  fecha: string;
  montoOrigen: number;
  tipoCambio: number;
  comision: number;
  concepto: string;
  referencia: string;
}

export function useTraspasoForm(open: boolean, cuentas: Cuenta[]) {
  const [state, setState] = useState<TraspasoFormState>({
    origenId: "",
    destinoId: "",
    fecha: hoyIso(),
    montoOrigen: 0,
    // UIA-02: 0 = "sin capturar". Antes el default 1 posteaba conversiones
    // 1:1 silenciosas entre monedas distintas.
    tipoCambio: 0,
    comision: 0,
    concepto: "",
    referencia: "",
  });

  useEffect(() => {
    if (!open) return;
    setState({
      origenId: "",
      destinoId: "",
      fecha: hoyIso(),
      montoOrigen: 0,
      tipoCambio: 0,
      comision: 0,
      concepto: "",
      referencia: "",
    });
  }, [open]);

  const setField = <K extends keyof TraspasoFormState>(key: K, value: TraspasoFormState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const origen = useMemo(() => cuentas.find((c) => c.id === state.origenId), [cuentas, state.origenId]);
  const destino = useMemo(() => cuentas.find((c) => c.id === state.destinoId), [cuentas, state.destinoId]);
  const mismoMoneda = origen && destino && origen.moneda === destino.moneda;

  // BL-04: cuando las monedas difieren sugerimos el TC DOF de la fecha del
  // traspaso. Es sólo una sugerencia editable; si el usuario lo borra, la
  // validación vuelve a exigirlo (nunca se asume 1).
  const requiereTc = !!origen && !!destino && !mismoMoneda;
  const { data: tcDof } = useTcDofPorFecha(state.fecha, requiereTc);
  const tcSugerido = useMemo(
    () => sugerirTc(tcDof, origen?.moneda, destino?.moneda),
    [tcDof, origen?.moneda, destino?.moneda],
  );

  useEffect(() => {
    if (!requiereTc || !tcSugerido) return;
    setState((prev) => (prev.tipoCambio > 0 ? prev : { ...prev, tipoCambio: tcSugerido }));
  }, [requiereTc, tcSugerido]);


  const montoDestino = useMemo(() => {
    if (!state.montoOrigen || state.montoOrigen <= 0) return 0;
    if (mismoMoneda) return state.montoOrigen;
    if (!state.tipoCambio || state.tipoCambio <= 0) return 0;
    // FE-07: la RPC redondea con ROUND(monto*tc, 2); el preview debe coincidir
    // centavo a centavo con el abono real.
    return roundMoney(state.montoOrigen * state.tipoCambio);
  }, [state.montoOrigen, mismoMoneda, state.tipoCambio]);

  const error = useMemo(() => {
    if (!state.origenId || !state.destinoId) return "Selecciona ambas cuentas.";
    if (state.origenId === state.destinoId) return "La cuenta origen y destino deben ser distintas.";
    if (!state.montoOrigen || state.montoOrigen <= 0) return "El monto debe ser mayor a cero.";
    if (!origen?.activa || !destino?.activa) return "Ambas cuentas deben estar activas.";
    // FE-07: fecha del traspaso obligatoria y nunca futura.
    if (!state.fecha) return "Captura la fecha del traspaso.";
    if (state.fecha > hoyIso()) return "La fecha del traspaso no puede ser futura.";
    if (!mismoMoneda && (!state.tipoCambio || state.tipoCambio <= 0)) {
      return "Captura el tipo de cambio para cuentas de distinta moneda.";
    }
    return null;
  }, [state, origen, destino, mismoMoneda]);

  return {
    state,
    setField,
    origen,
    destino,
    mismoMoneda,
    montoDestino,
    error,
    tcSugerido,
    fechaTcDof: tcDof?.fecha ?? null,
  };
}

type Moneda = Cuenta["moneda"];

/** Convierte el TC DOF (base MXN) al par origen→destino del traspaso. */
function sugerirTc(
  tc: { usdMxn: number; eurMxn: number | null } | null | undefined,
  origen?: Moneda,
  destino?: Moneda,
): number | null {
  if (!tc || !origen || !destino || origen === destino) return null;
  const aMxn = (m: Moneda): number | null =>
    m === "MXN" ? 1 : m === "USD" ? tc.usdMxn : tc.eurMxn;
  const o = aMxn(origen);
  const d = aMxn(destino);
  if (!o || !d || o <= 0 || d <= 0) return null;
  return Math.round((o / d) * 10000) / 10000;
}
