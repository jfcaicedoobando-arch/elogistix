/**
 * useEstadoCuentaEmail — envía el estado de cuenta del cliente por email.
 *
 * QW12 Tanda 3 — Quick Wins facturación.
 */
import { useMutationWithFeedback } from "@/hooks/shared/useMutationWithFeedback";
import { supabase } from "@/integrations/supabase/client";

export interface EnviarEstadoCuentaInput {
  clienteId: string;
  periodo?: string;
  contactoEmail?: string;
  mensaje?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}

export interface EnviarEstadoCuentaResult {
  ok: boolean;
  enviado_a?: string;
}

async function enviarEstadoCuentaEmail(input: EnviarEstadoCuentaInput): Promise<EnviarEstadoCuentaResult> {
  const { data, error } = await supabase.functions.invoke<EnviarEstadoCuentaResult>("cxc-estado-cuenta-enviar", {
    body: {
      cliente_id: input.clienteId,
      periodo: input.periodo ?? null,
      contacto_email: input.contactoEmail?.trim() ?? null,
      mensaje: input.mensaje?.trim() ?? null,
      fecha_desde: input.fechaDesde ?? null,
      fecha_hasta: input.fechaHasta ?? null,
    },
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error("No se pudo enviar el estado de cuenta");
  return data;
}

export function useEstadoCuentaEmail(options?: { onSuccess?: () => void }) {
  return useMutationWithFeedback({
    mutationFn: enviarEstadoCuentaEmail,
    successTitle: "Estado de cuenta enviado",
    successDescription: "El cliente recibirá un resumen por correo.",
    errorTitle: "No se pudo enviar el estado de cuenta",
    errorMethod: "ENVIAR_ESTADO_CUENTA_EMAIL",
    onSuccess: options?.onSuccess,
  });
}
