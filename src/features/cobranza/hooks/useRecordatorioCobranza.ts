/**
 * useRecordatorioCobranza — envía un recordatorio de pago manual para una
 * factura de cliente. La Edge Function valida el destinatario confirmado,
 * envía el correo y registra el resultado en `factura_recordatorios`.
 *
 * v13.313.1
 */
import { useMutationWithFeedback } from "@/hooks/shared/useMutationWithFeedback";
import { useRef } from "react";
import { AuthOperationChangedError, captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import { queryKeys } from "@/lib/query";
import {
  enviarRecordatorioCobranza,
  type RecordatorioCobranzaInput,
  type RecordatorioCobranzaResult,
} from "@/features/cobranza/services/recordatorioCobranzaService";

export type { RecordatorioCobranzaInput };

export function useRecordatorioCobranza({ onSuccess }: { onSuccess?: () => void } = {}) {
  const scopes = useRef(new WeakMap<RecordatorioCobranzaInput, ReturnType<typeof captureAuthOperationScope>>());
  const mutation = useMutationWithFeedback<RecordatorioCobranzaResult, Error, RecordatorioCobranzaInput>({
    mutationFn: (input) => {
      const scope = scopes.current.get(input);
      if (!scope) throw new AuthOperationChangedError();
      scope.assertCurrent();
      return enviarRecordatorioCobranza(input);
    },
    invalidate: [queryKeys.facturas.cobranza(), queryKeys.facturas.all],
    successTitle: "Recordatorio enviado",
    successDescription: "El recordatorio se envió correctamente.",
    errorTitle: "Error al enviar recordatorio",
    errorMethod: "USE_RECORDATORIO_COBRANZA",
    onSuccess,
  });
  const prepare = (input: RecordatorioCobranzaInput) => {
    const variables = { ...input };
    scopes.current.set(variables, captureAuthOperationScope());
    return variables;
  };
  return { ...mutation,
    mutate: (input: RecordatorioCobranzaInput, options?: Parameters<typeof mutation.mutate>[1]) =>
      mutation.mutate(prepare(input), options),
    mutateAsync: (input: RecordatorioCobranzaInput, options?: Parameters<typeof mutation.mutateAsync>[1]) =>
      mutation.mutateAsync(prepare(input), options),
  };
}
