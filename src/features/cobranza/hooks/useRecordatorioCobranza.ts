/**
 * useRecordatorioCobranza — envía un recordatorio de pago manual para una
 * factura de cliente. Persiste en `factura_recordatorios` y encola el correo
 * transaccional `recordatorio-cobranza` vía la edge function.
 *
 * v13.313.1
 */
import { useMutationWithFeedback } from "@/hooks/shared/useMutationWithFeedback";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query";

export interface RecordatorioCobranzaInput {
  facturaId: string;
  nota?: string;
  canal?: "email";
  contactoEmail?: string | null;
}

interface RecordatorioCobranzaResult {
  ok: true;
  enviado_a: string;
}

async function enviarRecordatorio(input: RecordatorioCobranzaInput): Promise<RecordatorioCobranzaResult> {
  const { data, error } = await supabase.functions.invoke<RecordatorioCobranzaResult & { error?: string }>(
    "cxc-recordatorio-enviar",
    {
      body: {
        factura_id: input.facturaId,
        nota: input.nota,
        canal: input.canal ?? "email",
        contacto_email: input.contactoEmail,
      },
    },
  );
  if (error) throw new Error(error.message);
  if (!data?.ok || !data.enviado_a) {
    throw new Error("No se pudo enviar el recordatorio.");
  }
  return data;
}

export function useRecordatorioCobranza({ onSuccess }: { onSuccess?: () => void } = {}) {
  return useMutationWithFeedback<RecordatorioCobranzaResult, Error, RecordatorioCobranzaInput>({
    mutationFn: enviarRecordatorio,
    invalidate: [queryKeys.facturas.cobranza(), queryKeys.facturas.all],
    successTitle: "Recordatorio enviado",
    successDescription: "El recordatorio se envió correctamente.",
    errorTitle: "Error al enviar recordatorio",
    errorMethod: "USE_RECORDATORIO_COBRANZA",
    onSuccess,
  });
}
