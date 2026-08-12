/**
 * Estado y validación del formulario de traspaso entre cuentas propias.
 * Extraído para mantener el modal bajo 200 líneas (Power of 10).
 */
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import { roundMoney } from "@/lib/financial/financialUtils";
import { useTcDofPorFecha } from "@/features/catalogos/hooks/useTcDofPorFecha";

type Cuenta = Tables<"cuentas_bancarias">;

const hoyIso = () => format(new Date(), "yyyy-MM-dd");

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
  };
}
