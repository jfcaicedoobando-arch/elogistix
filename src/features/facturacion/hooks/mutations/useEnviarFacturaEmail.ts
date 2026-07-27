import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import { enviarFacturaPorEmail, type EnviarFacturaEmailInput } from "@/features/facturacion/services/mutations/enviarFacturaEmail";
import { notifyError } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";

export function useEnviarFacturaEmail(facturaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EnviarFacturaEmailInput) => enviarFacturaPorEmail(input),
    onSuccess: (res) => {
      if (res.estado === "enviado") {
        notifySuccess(undefined, { title: "Factura enviada por correo" });
      } else if (res.estado === "parcial") {
        notifyWarning(undefined, { title: "Algunos correos no pudieron enviarse" });
      } else {
        notifyError(undefined, { title: "No se pudo enviar el correo", method: "FEATURES_FACTURACION_HOOKS_MUTATIONS_USEENVIARFACTURAEMAIL_1" });
      }
      if (facturaId) {
        qc.invalidateQueries({ queryKey: queryKeys.facturas.legacyDetail(facturaId) });
        qc.invalidateQueries({ queryKey: queryKeys.facturas.envios(facturaId) });
      }
      qc.invalidateQueries({ queryKey: queryKeys.facturas.all });
    },
    onError: (e: Error) =>
      notifyError(undefined, { title: e.message, error: e, method: "FEATURES_FACTURACION_HOOKS_MUTATIONS_USEENVIARFACTURAEMAIL_2" }),
  });
}
