/**
 * useBanxicoTipoCambio — obtiene el TC DOF publicado por Banxico para USD/EUR
 * consultando la edge function `banxico-tipo-cambio` (serie SF43718 / SF46410).
 * Devuelve una `useMutation` lista para conectar a un botón "Obtener TC DOF".
 */
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { notifyError } from "@/components/shared/utils/appFeedback";

export interface BanxicoTcResult {
  tipoCambio: number;
  fecha: string;
  serie: string;
  moneda: string;
}

export function useBanxicoTipoCambio(moneda: string, onTC: (tc: number) => void) {
  return useMutation({
    mutationFn: async (): Promise<BanxicoTcResult> => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/banxico-tipo-cambio?moneda=${moneda}`;
      const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${session?.access_token ?? anon}`,
          "apikey": anon,
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Banxico HTTP ${res.status}`);
      }
      return (await res.json()) as BanxicoTcResult;
    },
    onSuccess: (d) => {
      onTC(d.tipoCambio);
      toast.success(`TC DOF ${d.moneda}: ${d.tipoCambio} (${d.fecha})`, {
        description: "Recuerda presionar Guardar cambios para aplicarlo al CFDI.",
      });
    },
    onError: (err) =>
      notifyError(toast, { title: "No se pudo obtener TC DOF", error: err, method: "BANXICO_TC" }),
  });
}
