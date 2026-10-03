/**
 * Regeneración del movimiento bancario faltante de un pago (v13.495.0).
 * Al terminar invalida CxP y tesorería para que la conciliación y el saldo
 * de la cuenta reflejen el movimiento recién creado.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { regenerarMovimientoPagoProveedor } from "@/features/cxp/services/pagoProveedorMovimientoRegenerar";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

export function useRegenerarMovimientoPago() {
  const qc = useQueryClient();
  return useMutation<string, Error, string>({
    mutationFn: regenerarMovimientoPagoProveedor,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all });
      notifySuccess(undefined, {
        title: "Movimiento bancario generado",
        description: "El pago ya aparece en el estado de cuenta y quedó conciliado.",
      });
    },
    onError: (error) => {
      notifyError(undefined, {
        title: "No se pudo generar el movimiento bancario",
        error,
        method: "REGENERAR_MOVIMIENTO_PAGO_PROVEEDOR",
      });
    },
  });
}
