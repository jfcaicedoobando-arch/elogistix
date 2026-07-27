/**
 * useTcDofPorFecha — obtiene el TC DOF Banxico vigente para una fecha objetivo.
 *
 * A diferencia de `useBanxicoTipoCambio` (que siempre pide el DOF de HOY para
 * facturación al cliente), este hook acepta la fecha de emisión de una factura
 * de proveedor y devuelve la Publicación DOF vigente en ese día.
 *
 * v13.219.0 — auto-fill del TC en captura/edición de facturas de proveedor.
 */
import { useMutation } from "@tanstack/react-query";

import { fetchExchangeRates } from "@/features/catalogos/services";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { todayLocalISO } from "@/lib/date/today";

export type MonedaTc = "USD" | "EUR";

export interface TcDofResult {
  tipoCambio: number;
  moneda: MonedaTc;
  fechaAplicada?: string;
  fechaConsultada: string;
}

export interface TcDofArgs {
  moneda: MonedaTc;
  fecha: string; // YYYY-MM-DD (fecha de emisión de la factura)
  silent?: boolean; // si true, no muestra toast de éxito
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isFechaEmisionValida(fecha: string): boolean {
  if (!ISO_RE.test(fecha)) return false;
  const hoy = todayLocalISO();
  if (fecha > hoy) return false; // no consultamos fechas futuras
  return true;
}

/** Formatea `YYYY-MM-DD` como `DD/MM/YYYY` para mensajes en UI. */
export function formatFechaEs(iso?: string): string {
  if (!iso || !ISO_RE.test(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Devuelve una mutación que consulta el TC DOF Banxico para la fecha dada y
 * lo entrega vía `onTc` (callback controlado por el hook consumidor).
 */
export function useTcDofPorFecha(onTc: (r: TcDofResult) => void) {
  return useMutation({
    mutationFn: async ({ moneda, fecha }: TcDofArgs): Promise<TcDofResult> => {
      if (!isFechaEmisionValida(fecha)) {
        throw new Error("Fecha de emisión inválida o futura");
      }
      const rates = await fetchExchangeRates(fecha);
      const tipoCambio = moneda === "USD" ? rates.usdMxn : rates.eurMxn;
      if (!tipoCambio || tipoCambio <= 0) {
        throw new Error(`Banxico no devolvió TC para ${moneda} en ${fecha}`);
      }
      return {
        tipoCambio,
        moneda,
        fechaAplicada: rates.fechaAplicada,
        fechaConsultada: fecha,
      };
    },
    onSuccess: (r, args) => {
      onTc(r);
      if (!args.silent) {
        notifySuccess(undefined, {
          title: `TC DOF ${r.moneda}: ${r.tipoCambio}`,
          description: r.fechaAplicada
            ? `Publicación DOF vigente al ${formatFechaEs(args.fecha)} (FIX ${formatFechaEs(r.fechaAplicada)}).`
            : `Consulta para emisión ${formatFechaEs(args.fecha)}.`,
        });
      }
    },
    onError: (err) =>
      notifyError(undefined, {
        title: "No se pudo obtener TC DOF",
        error: err,
        method: "FEATURES_CXP_HOOKS_USETCDOFPORFECHA_1",
      }),
  });
}
