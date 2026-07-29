/**
 * useEnviarProformaEmail — envía la proforma por correo al cliente vía
 * edge function, invalidando la lista de proformas al terminar.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/shared";
import { enviarProformaPorEmail } from "@/features/proformas/services/enviarEmail";
import { notifyError } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";

export interface EnviarProformaVars {
  to: { email: string }[];
  ccList: string[];
  asunto: string;
  mensaje: string;
}

export interface EnvioProformaOk { enlace_portal: string; estado: string }

export function useEnviarProformaEmail(
  proformaId: string,
  onEnviado: (res: EnvioProformaOk, vars: EnviarProformaVars) => void,
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
      onEnviado(res, vars);
      toast({ title: "Correo enviado", description: `Estado: ${res.estado}` });
      await qc.invalidateQueries({ queryKey: queryKeys.proformas.all });
    },
    onError: (e: Error) => {
      notifyError(undefined, {
        title: "No se pudo enviar",
        description: e.message,
        error: e,
        method: "PROFORMAS_ENVIAR_EMAIL",
      });
    },
  });
}
