import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { enviarFacturaPorEmail, type EnviarFacturaEmailInput } from "@/features/facturacion/services/mutations/enviarFacturaEmail";
import { notifyError } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";

export function useEnviarFacturaEmail(facturaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EnviarFacturaEmailInput) => enviarFacturaPorEmail(input),
    onSuccess: (res) => {
      if (res.estado === "enviado") {
        toast.success("Factura enviada por correo");
      } else if (res.estado === "parcial") {
        toast.warning("Algunos correos no pudieron enviarse");
      } else {
        notifyError(toast, { title: "No se pudo enviar el correo", method: "FEATURES_FACTURACION_HOOKS_MUTATIONS_USEENVIARFACTURAEMAIL_1" });
      }
      if (facturaId) {
        qc.invalidateQueries({ queryKey: queryKeys.facturas.legacyDetail(facturaId) });
        qc.invalidateQueries({ queryKey: queryKeys.facturas.envios(facturaId) });
      }
      qc.invalidateQueries({ queryKey: queryKeys.facturas.all });
    },
    onError: (e: Error) =>
      notifyError(toast, { title: e.message, error: e, method: "FEATURES_FACTURACION_HOOKS_MUTATIONS_USEENVIARFACTURAEMAIL_2" }),
  });
}
