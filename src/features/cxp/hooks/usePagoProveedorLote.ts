/**
 * Hook de pago en lote a proveedor (v13.445.0).
 * Invalida CxP, bandejas y tesorería (el lote genera un movimiento bancario).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  registrarPagoProveedorLote,
  type RegistrarPagoLoteInput,
} from "@/features/cxp/services/pagoProveedorLote";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { traducirErrorPagoProveedor } from "@/features/cxp/services/pagosProveedorErrors";

export function usePagoProveedorLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegistrarPagoLoteInput) => registrarPagoProveedorLote(input),
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all });
      // B-2: la bandeja "CxP por pagar" y su badge leen `bandejas.all`; sin
      // esto la factura recién pagada seguía como pendiente (riesgo de doble pago).
      qc.invalidateQueries({ queryKey: queryKeys.bandejas.all });
      // Paridad con el pago individual: el detalle 360 del proveedor lee las
      // mismas tablas.
      qc.invalidateQueries({ queryKey: queryKeys.proveedores.all });
      notifySuccess(undefined, {
        title: `Pago en lote registrado en ${vars.renglones.filter((r) => r.monto > 0).length} facturas`,
      });
    },
    onError: (error: Error) => {
      notifyError(undefined, {
        title: traducirErrorPagoProveedor(error),
        error,
        method: "REGISTRAR_PAGO_PROVEEDOR_LOTE",
      });
    },
  });
}
