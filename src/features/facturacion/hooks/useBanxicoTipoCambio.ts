/**
 * useBanxicoTipoCambio — obtiene el TC de Publicación DOF USD/EUR llamando a
 * la edge function unificada `exchange-rates`.
 *
 * v13.166.0: se absorbió `banxico-tipo-cambio` en `exchange-rates`.
 * v13.205.5: la edge ahora consulta SF43718 (USD) y SF46410 (EUR) en un rango
 * de 10 días y selecciona explícitamente el FIX del día hábil ANTERIOR a hoy,
 * que es la Publicación DOF vigente para CFDI emitidos hoy (Art. 20 CFF).
 * v13.303.44 (FIX-10 auditoría): si la edge responde con `esFallback: true`
 * (Banxico caído o sin token) NO se propaga el TC ni se auto-guarda en la
 * factura; se muestra error accionable para que el usuario reintente.
 */

import { useMutation } from "@tanstack/react-query";

import { fetchExchangeRates } from "@/features/catalogos/services";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

export interface BanxicoTcResult {
  tipoCambio: number;
  moneda: string;
}

/**
 * Devuelve una mutación que consulta el TC DOF de Banxico y ejecuta `onTC`
 * con el valor. Auto-guarda a través del callback (no requiere botón manual).
 */
export function useBanxicoTipoCambio(moneda: string, onTC: (tc: number | null) => void) {
  return useMutation({
    mutationFn: async (): Promise<BanxicoTcResult> => {
      const rates = await fetchExchangeRates();
      // FIX-10: el fallback jamás se usa en flujos fiscales; forzar reintento.
      if (rates.esFallback) {
        throw new Error(
          "LC_TC_DOF_NO_DISPONIBLE: Banxico no respondió con el TC del DOF. Intenta más tarde; no se guardó ningún valor en la factura.",
        );
      }
      const tipoCambio =
        moneda === "USD" ? rates.usdMxn :
        moneda === "EUR" ? rates.eurMxn : 1;
      if (!tipoCambio || tipoCambio <= 0) {
        throw new Error(`Banxico no devolvió TC para ${moneda}`);
      }
      return { tipoCambio, moneda };
    },
    onSuccess: (d) => {
      onTC(d.tipoCambio);
      notifySuccess(undefined, {
        title: `TC DOF ${d.moneda}: ${d.tipoCambio}`,
        description: "Guardado automáticamente en la factura.",
      });
    },
    onError: (err) =>
      notifyError(undefined, { title: "No se pudo obtener TC DOF", error: err, method: "BANXICO_TC" }),
  });
}
