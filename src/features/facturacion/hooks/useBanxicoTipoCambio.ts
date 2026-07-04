/**
 * useBanxicoTipoCambio — obtiene el TC DOF publicado por Banxico para USD/EUR
 * llamando a la edge function unificada `exchange-rates` (que consulta las
 * series SF43718 y SF46410 con caché de 12 h).
 *
 * v13.166.0: antes existía una function separada `banxico-tipo-cambio`; se
 * absorbió en `exchange-rates` para tener un único punto de verdad para el
 * TC DOF en todo el sistema.
 */
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchExchangeRates } from "@/features/catalogos/services";
import { notifyError } from "@/components/shared/utils/appFeedback";

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
      toast.success(`TC DOF ${d.moneda}: ${d.tipoCambio}`, {
        description: "Guardado automáticamente en la factura.",
      });
    },
    onError: (err) =>
      notifyError(toast, { title: "No se pudo obtener TC DOF", error: err, method: "BANXICO_TC" }),
  });
}
