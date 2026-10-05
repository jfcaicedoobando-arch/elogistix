/**
 * Estado del formulario de traspaso entre cuentas propias.
 * La validación y los ayudantes puros viven en
 * `@/features/tesoreria/domain/traspasoForm` (Power of 10: ≤200 líneas).
 */
import { useEffect, useMemo, useState } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { useTcDofPorFecha } from "@/features/catalogos/hooks/useTcDofPorFecha";
import { multiplicadorOrigenDestino, parTc } from "@/features/tesoreria/domain/tcPar";
import { fechaMinimaTraspaso, validarFechaTraspaso } from "@/features/tesoreria/domain/traspasoFecha";
import {
  ESTADO_INICIAL, hoyIso, sugerirTcQuote, validarTraspaso, calcularMontoDestinoTraspaso,
} from "@/features/tesoreria/domain/traspasoForm";

type Cuenta = Tables<"cuentas_bancarias">;

export type { TraspasoFormState } from "@/features/tesoreria/domain/traspasoForm";
export {
  sugerirTcQuote, traspasoSucio, conceptoTraspaso, partesTraspaso,
} from "@/features/tesoreria/domain/traspasoForm";

export function useTraspasoForm(open: boolean, cuentas: Cuenta[]) {
  const [state, setState] = useState({ ...ESTADO_INICIAL, fecha: hoyIso() });
  /** MNY P2.4: fecha con la que abrió el diálogo (para detectar cambios). */
  const [fechaInicial, setFechaInicial] = useState(hoyIso);
  /**
   * MNY: ¿el T/C actual lo escribió el usuario? Sólo así se conserva al
   * cambiar la fecha. Antes la sugerencia se aplicaba una única vez y, al
   * mover la fecha, quedaba la tasa de otro día con la fecha nueva en pantalla.
   */
  const [tcEsManual, setTcEsManual] = useState(false);
  const [capturasNegativas, setCapturasNegativas] = useState({ montoOrigen: false, comision: false });

  useEffect(() => {
    if (!open) return;
    const hoy = hoyIso();
    setState({ ...ESTADO_INICIAL, fecha: hoy });
    setFechaInicial(hoy);
    setTcEsManual(false);
    setCapturasNegativas({ montoOrigen: false, comision: false });
  }, [open]);

  /**
   * MNY P1.1: al cambiar una cuenta puede cambiar el par de monedas, así que la
   * tasa escrita a mano para el par anterior se invalida (nunca se recicla
   * 18.00 USD/MXN como EUR/MXN). El efecto de sugerencia carga la del par nuevo.
   */
  const setField = <K extends keyof typeof ESTADO_INICIAL>(
    key: K,
    value: (typeof ESTADO_INICIAL)[K],
  ) => {
    if (key === "tcQuote") setTcEsManual(true);
    const cambiaCuenta = key === "origenId" || key === "destinoId";
    if (cambiaCuenta) setTcEsManual(false);
    setState((prev) => ({
      ...prev,
      [key]: value,
      ...(cambiaCuenta && prev[key] !== value ? { tcQuote: 0 } : {}),
    }));
  };

  const origen = useMemo(() => cuentas.find((c) => c.id === state.origenId), [cuentas, state.origenId]);
  const destino = useMemo(() => cuentas.find((c) => c.id === state.destinoId), [cuentas, state.destinoId]);
  const fechaMinima = fechaMinimaTraspaso(origen, destino);
  const errorFecha = validarFechaTraspaso(state.fecha, fechaMinima);
  const mismoMoneda = origen && destino && origen.moneda === destino.moneda;
  const par = useMemo(() => parTc(origen?.moneda, destino?.moneda), [origen?.moneda, destino?.moneda]);

  // BL-04: cuando las monedas difieren sugerimos el TC DOF de la fecha del
  // traspaso. Es sólo una sugerencia editable; si el usuario lo borra, la
  // validación vuelve a exigirlo (nunca se asume 1).
  const requiereTc = !!origen && !!destino && !mismoMoneda;
  const { data: tcDof } = useTcDofPorFecha(state.fecha, requiereTc);
  const tcSugerido = useMemo(() => sugerirTcQuote(tcDof, par), [tcDof, par]);

  useEffect(() => {
    if (!requiereTc || !tcSugerido || tcEsManual) return;
    // La sugerencia se re-aplica al cambiar fecha o par mientras el valor
    // siga siendo automático.
    setState((prev) => (prev.tcQuote === tcSugerido ? prev : { ...prev, tcQuote: tcSugerido }));
  }, [requiereTc, tcSugerido, tcEsManual]);

  // Multiplicador que consume la RPC: monto_destino = monto_origen * factor.
  const factorOrigenDestino = useMemo(() => {
    if (mismoMoneda) return 1;
    return multiplicadorOrigenDestino(par, origen?.moneda, state.tcQuote);
  }, [mismoMoneda, par, origen?.moneda, state.tcQuote]);

  const montoDestino = useMemo(() => {
    // FE-07: la RPC redondea con ROUND(monto*tc, 2); el preview debe coincidir
    // centavo a centavo con el abono real.
    return calcularMontoDestinoTraspaso(state.montoOrigen, factorOrigenDestino);
  }, [state.montoOrigen, factorOrigenDestino]);

  const error = useMemo(
    () => capturasNegativas.montoOrigen || capturasNegativas.comision
      ? "Corrige los importes negativos: el monto debe ser mayor a cero y la comisión no puede ser negativa."
      : validarTraspaso(state, origen, destino, !!mismoMoneda, par),
    [state, origen, destino, mismoMoneda, par, capturasNegativas],
  );

  const revisarCaptura = (campo: "montoOrigen" | "comision", raw: string) => {
    const negativa = /[-−]/.test(raw) || /^\s*\(.*\)\s*$/.test(raw);
    setCapturasNegativas((prev) => prev[campo] === negativa ? prev : { ...prev, [campo]: negativa });
  };

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
    revisarCaptura,
    capturasNegativas,
    tcSugerido,
    tcEsManual,
    fechaInicial,
    fechaMinima,
    errorFecha,
    corteOrigen: origen?.fecha_saldo_inicial,
    corteDestino: destino?.fecha_saldo_inicial,
    fechaTcDof: tcDof?.fecha ?? null,
  };
}
