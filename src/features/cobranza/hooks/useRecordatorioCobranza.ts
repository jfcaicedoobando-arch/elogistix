/**
 * useRecordatorioCobranza — envía un recordatorio de pago manual para una
 * factura de cliente. Persiste en `factura_recordatorios` y encola el correo
 * transaccional `recordatorio-cobranza` vía la edge function.
 *
 * v13.313.1
 */
import { useMutationWithFeedback } from "@/hooks/shared/useMutationWithFeedback";
import { queryKeys } from "@/lib/query";
import {
  enviarRecordatorioCobranza,
  type RecordatorioCobranzaInput,
  type RecordatorioCobranzaResult,
} from "@/features/cobranza/services/recordatorioCobranzaService";

export type { RecordatorioCobranzaInput };

export function useRecordatorioCobranza({ onSuccess }: { onSuccess?: () => void } = {}) {
  return useMutationWithFeedback<RecordatorioCobranzaResult, Error, RecordatorioCobranzaInput>({
    mutationFn: enviarRecordatorioCobranza,
    invalidate: [queryKeys.facturas.cobranza(), queryKeys.facturas.all],
    successTitle: "Recordatorio enviado",
    successDescription: "El recordatorio se envió correctamente.",
    errorTitle: "Error al enviar recordatorio",
    errorMethod: "USE_RECORDATORIO_COBRANZA",
    onSuccess,
  });
}
