import { useMutationWithFeedback } from "@/hooks/shared";
import { queryKeys } from "@/lib/query";
import { tesoreria as tesoreriaKeys } from "@/features/tesoreria/queryKeys";
import {
  ejecutarPagoProgramado,
  type EjecutarPagoProgramadoInput,
} from "@/features/tesoreria/services/ejecutarPagoProgramado";

/** Ejecuta un pago programado: descuenta saldo de la cuenta y marca la factura. */
export function useEjecutarPagoProgramado() {
  return useMutationWithFeedback({
    mutationFn: (input: EjecutarPagoProgramadoInput) => ejecutarPagoProgramado(input),
    invalidate: [tesoreriaKeys.all, queryKeys.cxp.all, queryKeys.proveedorFacturas.all],
    successTitle: "Pago ejecutado y aplicado a la factura",
    errorTitle: "No se pudo ejecutar el pago",
    errorMethod: "FEATURES_TESORERIA_HOOKS_USEEJECUTARPAGOPROGRAMADO",
  });
}
