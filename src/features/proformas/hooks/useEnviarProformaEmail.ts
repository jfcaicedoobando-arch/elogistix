/**
 * useEnviarProformaEmail — envía la proforma por correo al cliente vía
 * edge function, invalidando la lista de proformas al terminar.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/shared";
import { enviarProformaPorEmail, type EnviarProformaEmailResult } from "@/features/proformas/services/enviarEmail";
import { notifyError } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";

export interface EnviarProformaVars {
  to: { email: string }[];
  ccList: string[];
  asunto: string;
  mensaje: string;
}

export function useEnviarProformaEmail(
  proformaId: string,
  onResultado: (res: EnviarProformaEmailResult, vars: EnviarProformaVars) => void,
) {
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationKey: queryKeys.proformas.enviarEmail(proformaId),
    mutationFn: async ({ to, ccList, asunto, mensaje }: EnviarProformaVars) => {
      return enviarProformaPorEmail({
        proformaId,
        destinatarios: to,
        cc: ccList,
        asunto,
        mensaje,
      });
    },
    onSuccess: async (res, vars) => {
      onResultado(res, vars);
      if (res.estado === "pendiente") return;
      if (res.estado === "enviado") toast({ title: "Correo enviado" });
      await qc.invalidateQueries({ queryKey: queryKeys.proformas.all });
    },
    onError: (e: Error) => {
      notifyError(undefined, {
        title: "El envío no se confirmó",
        description: e.message,
        error: e,
        method: "PROFORMAS_ENVIAR_EMAIL",
      });
    },
  });
}
