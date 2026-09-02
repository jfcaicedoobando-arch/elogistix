import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  listarPagosProveedor,
  registrarPagoProveedor,
  eliminarPagoProveedor,
  actualizarPagoProveedor,
  type RegistrarPagoProveedorInput,
  type ActualizarPagoProveedorInput,
} from "@/features/cxp/services";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { traducirErrorPagoProveedor } from "@/features/cxp/services/pagosProveedorErrors";
import { invalidateProfitDependencies } from "@/features/profit/hooks/invalidateProfitDependencies";

export function usePagosProveedor(facturaId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.cxp.pagos(facturaId ?? ""),
    queryFn: () => listarPagosProveedor(facturaId!),
    enabled: !!facturaId,
    staleTime: 30_000,
  });
}

export function useRegistrarPagoProveedor() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: RegistrarPagoProveedorInput) =>
      registrarPagoProveedor(input, user?.id ?? null),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.cxp.pagos(vars.proveedor_factura_id) });
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      // R6-N1: el pago genera un movimiento bancario → refrescar saldos y conciliación.
      qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all });
      // Ola 12 · R3P-02: el detalle 360 del proveedor lee las mismas tablas.
      qc.invalidateQueries({ queryKey: queryKeys.proveedores.all });
      // B-2: refrescar la bandeja "CxP por pagar" y su badge de conteo.
      qc.invalidateQueries({ queryKey: queryKeys.bandejas.all });
      // Defecto 6 (v13.823.43): Dirección y Dashboard Ejecutivo leen los mismos
      // pagos; antes seguían mostrando el pulso financiero anterior.
      invalidateProfitDependencies(qc);
      // Los toasts de éxito y error los emite `DialogRegistrarPagoProveedor`
      // (única vía UI actual). Se omiten aquí para evitar el doble toast
      // reportado en 13.218.2 (Karol, registro de pago).
    },
  });
}

export function useEliminarPagoProveedor(facturaId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (pagoId: string) => eliminarPagoProveedor(pagoId, facturaId, user?.id ?? null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cxp.pagos(facturaId) });
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all });
      // Ola 12 · R3P-02: el detalle 360 del proveedor lee las mismas tablas.
      qc.invalidateQueries({ queryKey: queryKeys.proveedores.all });
      // B-2: refrescar la bandeja "CxP por pagar" y su badge de conteo.
      qc.invalidateQueries({ queryKey: queryKeys.bandejas.all });
      // Defecto 6 (v13.823.43): Dirección y Dashboard Ejecutivo leen los mismos
      // pagos; antes seguían mostrando el pulso financiero anterior.
      invalidateProfitDependencies(qc);
      notifySuccess(undefined, { title: "Pago a proveedor eliminado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: traducirErrorPagoProveedor(error), error, method: "DELETE_PAYMENT_PROVEEDOR" });
    },
  });
}

/**
 * v13.395.0 — Edición de un pago existente. Las mismas validaciones de
 * montos/IVA/totales se aplican antes de llamar a esta mutación.
 */
export function useActualizarPagoProveedor(facturaId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: ActualizarPagoProveedorInput) =>
      actualizarPagoProveedor(input, user?.id ?? null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cxp.pagos(facturaId) });
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all });
      // Ola 12 · R3P-02: el detalle 360 del proveedor lee las mismas tablas.
      qc.invalidateQueries({ queryKey: queryKeys.proveedores.all });
      // B-2: refrescar la bandeja "CxP por pagar" y su badge de conteo.
      qc.invalidateQueries({ queryKey: queryKeys.bandejas.all });
      // Defecto 6 (v13.823.43): Dirección y Dashboard Ejecutivo leen los mismos
      // pagos; antes seguían mostrando el pulso financiero anterior.
      invalidateProfitDependencies(qc);
      qc.invalidateQueries({ queryKey: queryKeys.bitacora.all });
    },
    onError: (error: Error) => {
      notifyError(undefined, {
        title: traducirErrorPagoProveedor(error),
        error,
        method: "UPDATE_PAYMENT_PROVEEDOR",
      });
    },
  });
}
